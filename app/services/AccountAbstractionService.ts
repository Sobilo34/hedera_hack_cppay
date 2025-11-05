/**
 * Account Abstraction Service (ERC-4337)
 * Handles UserOperation creation, signing, and submission
 * 
 * Integrates with:
 * - Pimlico Bundler
 * - CPPay Paymaster
 * - Smart Account Contracts
 */

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther,
  encodeFunctionData,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { liskSepolia } from 'viem/chains';

// Environment configuration
const BUNDLER_URL = process.env.EXPO_PUBLIC_BUNDLER_URL || 'https://api.pimlico.io/v1/lisk-sepolia/rpc';
const PIMLICO_API_KEY = process.env.EXPO_PUBLIC_PIMLICO_API_KEY;
const PAYMASTER_ADDRESS = process.env.EXPO_PUBLIC_PAYMASTER_ADDRESS as Address;
const ENTRYPOINT_ADDRESS = process.env.EXPO_PUBLIC_ENTRYPOINT_ADDRESS as Address || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const CHAIN_ID = parseInt(process.env.EXPO_PUBLIC_CHAIN_ID || '4202');

// ERC-20 ABI (transfer function)
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Simple Account ABI (execute function)
const SIMPLE_ACCOUNT_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'dest', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'func', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface UserOperationReceipt {
  userOpHash: Hex;
  success: boolean;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  logs: any[];
}

class AccountAbstractionService {
  private publicClient;
  private bundlerClient;

  constructor() {
    // Public client for reading blockchain state
    this.publicClient = createPublicClient({
      chain: liskSepolia,
      transport: http(),
    });

    // Bundler client for submitting UserOperations
    this.bundlerClient = createPublicClient({
      chain: liskSepolia,
      transport: http(BUNDLER_URL, {
        fetchOptions: {
          headers: {
            'x-api-key': PIMLICO_API_KEY || '',
          },
        },
      }),
    });
  }

  /**
   * Create UserOperation for native token transfer
   */
  async createNativeTransferOp(
    smartWalletAddress: Address,
    privateKey: Hex,
    toAddress: Address,
    amount: bigint
  ): Promise<UserOperation> {
    console.log('🔨 Creating native transfer UserOp...');

    // Encode the call data
    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'execute',
      args: [toAddress, amount, '0x'],
    });

    // Get nonce
    const nonce = await this.getNonce(smartWalletAddress);

    // Get gas prices
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices();

    // Estimate gas
    const gasEstimate = await this.estimateGas(smartWalletAddress, callData);

    // Create unsigned UserOperation
    const userOp: Partial<UserOperation> = {
      sender: smartWalletAddress,
      nonce,
      initCode: '0x', // Account already deployed
      callData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: await this.getPaymasterData(smartWalletAddress, callData),
      signature: '0x', // Will be filled after signing
    };

    // Sign the UserOperation
    const signature = await this.signUserOp(userOp as UserOperation, privateKey);
    userOp.signature = signature;

    console.log('✅ UserOp created:', userOp);
    return userOp as UserOperation;
  }

  /**
   * Create UserOperation for ERC-20 token transfer
   */
  async createERC20TransferOp(
    smartWalletAddress: Address,
    privateKey: Hex,
    tokenAddress: Address,
    toAddress: Address,
    amount: bigint
  ): Promise<UserOperation> {
    console.log('🔨 Creating ERC-20 transfer UserOp...');

    // Encode ERC-20 transfer call
    const transferCallData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress, amount],
    });

    // Encode the execute call (Smart Account calls ERC-20 contract)
    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'execute',
      args: [tokenAddress, 0n, transferCallData],
    });

    // Get nonce
    const nonce = await this.getNonce(smartWalletAddress);

    // Get gas prices
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices();

    // Estimate gas
    const gasEstimate = await this.estimateGas(smartWalletAddress, callData);

    // Create unsigned UserOperation
    const userOp: Partial<UserOperation> = {
      sender: smartWalletAddress,
      nonce,
      initCode: '0x',
      callData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: await this.getPaymasterData(smartWalletAddress, callData),
      signature: '0x',
    };

    // Sign the UserOperation
    const signature = await this.signUserOp(userOp as UserOperation, privateKey);
    userOp.signature = signature;

    console.log('✅ ERC-20 transfer UserOp created');
    return userOp as UserOperation;
  }

  /**
   * Create UserOperation for token swap + transfer (multi-call)
   */
  async createSwapAndTransferOp(
    smartWalletAddress: Address,
    privateKey: Hex,
    swapCallData: Hex,
    dexAddress: Address,
    finalTransferTo: Address,
    finalAmount: bigint
  ): Promise<UserOperation> {
    console.log('🔨 Creating swap + transfer UserOp...');

    // For now, simplified: execute swap
    // In production, this would be a batch of calls:
    // 1. Approve DEX to spend token
    // 2. Execute swap
    // 3. Transfer result to recipient

    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'execute',
      args: [dexAddress, 0n, swapCallData],
    });

    const nonce = await this.getNonce(smartWalletAddress);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices();
    const gasEstimate = await this.estimateGas(smartWalletAddress, callData);

    const userOp: Partial<UserOperation> = {
      sender: smartWalletAddress,
      nonce,
      initCode: '0x',
      callData,
      callGasLimit: gasEstimate.callGasLimit * 2n, // Higher limit for swap
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: await this.getPaymasterData(smartWalletAddress, callData),
      signature: '0x',
    };

    const signature = await this.signUserOp(userOp as UserOperation, privateKey);
    userOp.signature = signature;

    console.log('✅ Swap UserOp created');
    return userOp as UserOperation;
  }

  /**
   * Submit UserOperation to bundler
   * Note: This is now deprecated - use BundlerService.sendUserOperation() directly
   */
  async submitUserOp(userOp: UserOperation): Promise<Hex> {
    console.log('📤 Submitting UserOp to bundler...');
    console.warn('⚠️ submitUserOp is deprecated. Use BundlerService.sendUserOperation() instead');

    // Import BundlerService dynamically to avoid circular dependency
    const BundlerService = require('./BundlerService').default;
    return await BundlerService.sendUserOperation(userOp);
  }

  /**
   * Wait for UserOperation receipt
   * Note: This is now deprecated - use BundlerService.waitForUserOp() directly
   */
  async waitForUserOpReceipt(userOpHash: Hex, timeout = 30000): Promise<UserOperationReceipt> {
    console.log('⏳ Waiting for UserOp receipt...');
    console.warn('⚠️ waitForUserOpReceipt is deprecated. Use BundlerService.waitForUserOp() instead');

    // Import BundlerService dynamically to avoid circular dependency
    const BundlerService = require('./BundlerService').default;
    const status = await BundlerService.waitForUserOp(userOpHash, timeout);

    return {
      userOpHash,
      success: status.status === 'included',
      actualGasCost: BigInt(status.gasUsed || '0'),
      actualGasUsed: BigInt(status.gasUsed || '0'),
      logs: [],
    };
  }

  /**
   * Get nonce for smart account
   */
  private async getNonce(smartWalletAddress: Address): Promise<bigint> {
    try {
      const nonce = await this.bundlerClient.request({
        method: 'eth_getUserOperationNonce' as any,
        params: [smartWalletAddress, ENTRYPOINT_ADDRESS],
      }) as Hex;

      return BigInt(nonce);
    } catch (error) {
      console.warn('Failed to get nonce, using 0:', error);
      return 0n;
    }
  }

  /**
   * Get gas prices
   */
  private async getGasPrices() {
    const feeData = await this.publicClient.estimateFeesPerGas();

    return {
      maxFeePerGas: feeData.maxFeePerGas || parseEther('0.00001'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || parseEther('0.000001'),
    };
  }

  /**
   * Estimate gas for UserOperation
   */
  private async estimateGas(
    sender: Address,
    callData: Hex
  ): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  }> {
    try {
      const estimate = await this.bundlerClient.request({
        method: 'eth_estimateUserOperationGas' as any,
        params: [
          {
            sender,
            nonce: '0x0',
            initCode: '0x',
            callData,
            paymasterAndData: PAYMASTER_ADDRESS ? PAYMASTER_ADDRESS : '0x',
          },
          ENTRYPOINT_ADDRESS,
        ],
      }) as any;

      return {
        callGasLimit: BigInt(estimate.callGasLimit),
        verificationGasLimit: BigInt(estimate.verificationGasLimit),
        preVerificationGas: BigInt(estimate.preVerificationGas),
      };
    } catch (error) {
      console.warn('Gas estimation failed, using defaults:', error);
      return {
        callGasLimit: 100000n,
        verificationGasLimit: 300000n,
        preVerificationGas: 50000n,
      };
    }
  }

  /**
   * Get paymaster data for gas sponsorship
   */
  private async getPaymasterData(
    sender: Address,
    callData: Hex
  ): Promise<Hex> {
    if (!PAYMASTER_ADDRESS) {
      console.log('⚠️ No paymaster configured, user pays gas');
      return '0x';
    }

    try {
      // Request paymaster to sponsor this operation
      // In production, this would call Pimlico's paymaster API
      console.log('🎫 Requesting gas sponsorship from paymaster...');
      
      // For now, return paymaster address as paymasterAndData
      // Format: paymasterAddress + validUntil (48 bytes) + validAfter (48 bytes)
      const validUntil = (Math.floor(Date.now() / 1000) + 3600).toString(16).padStart(12, '0');
      const validAfter = '0'.padStart(12, '0');
      
      return `${PAYMASTER_ADDRESS}${validUntil}${validAfter}` as Hex;
    } catch (error) {
      console.warn('Paymaster request failed, proceeding without sponsorship:', error);
      return '0x';
    }
  }

  /**
   * Sign UserOperation
   */
  private async signUserOp(userOp: UserOperation, privateKey: Hex): Promise<Hex> {
    const account = privateKeyToAccount(privateKey);

    // Create hash of UserOperation
    const userOpHash = this.getUserOpHash(userOp);

    // Sign the hash
    const signature = await account.signMessage({
      message: { raw: userOpHash },
    });

    return signature;
  }

  /**
   * Get UserOperation hash
   */
  private getUserOpHash(userOp: UserOperation): Hex {
    // Simplified hash calculation
    // In production, follow EIP-4337 spec exactly
    const packed = `${userOp.sender}${userOp.nonce.toString(16)}${userOp.callData}`;
    return `0x${packed}` as Hex;
  }

  /**
   * Check if account is deployed
   */
  async isAccountDeployed(address: Address): Promise<boolean> {
    const code = await this.publicClient.getBytecode({ address });
    return code !== undefined && code !== '0x';
  }
}

export default new AccountAbstractionService();
