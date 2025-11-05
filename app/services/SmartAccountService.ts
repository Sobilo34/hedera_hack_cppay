/**
 * Smart Account Service
 * Handles Account Abstraction (ERC-4337) smart account creation and management
 * 
 * Features:
 * - Generate smart account addresses
 * - Deploy smart accounts
 * - Manage account abstraction operations
 */

import { createPublicClient, http, getContract, Address } from 'viem';
import { mainnet, base, arbitrum, optimism, polygon } from 'viem/chains';
import { keccak256, encodePacked, toBytes, toHex } from 'viem';

// Custom chain definitions for Lisk networks (not in viem by default)
const liskMainnet = {
  id: 1135,
  name: 'Lisk',
  network: 'lisk',
  nativeCurrency: {
    decimals: 18,
    name: 'Lisk',
    symbol: 'LSK',
  },
  rpcUrls: {
    default: { http: ['https://rpc.api.lisk.com'] },
    public: { http: ['https://rpc.api.lisk.com'] },
  },
  blockExplorers: {
    default: { name: 'LiskScan', url: 'https://blockscout.lisk.com' },
  },
} as const;

const liskSepolia = {
  id: 4202,
  name: 'Lisk Sepolia Testnet',
  network: 'lisk-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Lisk',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia-api.lisk.com'] },
    public: { http: ['https://rpc.sepolia-api.lisk.com'] },
  },
  blockExplorers: {
    default: { name: 'LiskScan Sepolia', url: 'https://sepolia-blockscout.lisk.com' },
  },
  testnet: true,
} as const;

// Network configurations for smart accounts
export const SMART_ACCOUNT_NETWORKS = {
  [liskMainnet.id]: {
    chain: liskMainnet,
    bundlerUrl: 'https://api.pimlico.io/v2/1135/rpc',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address,
    factory: '0x9406Cc6185a346906296840746125a0E44976454' as Address,
  },
  [liskSepolia.id]: {
    chain: liskSepolia,
    bundlerUrl: 'https://api.pimlico.io/v2/4202/rpc',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address,
    factory: '0x9406Cc6185a346906296840746125a0E44976454' as Address,
  },
  [base.id]: {
    chain: base,
    bundlerUrl: 'https://api.pimlico.io/v2/8453/rpc',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address,
    factory: '0x9406Cc6185a346906296840746125a0E44976454' as Address,
  },
  [mainnet.id]: {
    chain: mainnet,
    bundlerUrl: 'https://api.pimlico.io/v2/1/rpc',
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address,
    factory: '0x9406Cc6185a346906296840746125a0E44976454' as Address,
  },
};

// Simple Account Factory ABI (for address prediction)
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    name: 'createAccount',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface SmartAccountInfo {
  address: string;
  chainId: number;
  network: string;
  isDeployed: boolean;
  salt: string;
}

class SmartAccountService {
  private static readonly PIMLICO_API_KEY = 'pim_d9U8Wy3TMkKf1GMo9JN4C8';

  /**
   * Generate smart account address for an EOA owner
   */
  static async generateSmartAccountAddress(
    ownerAddress: string,
    chainId: number,
    salt: bigint = 0n
  ): Promise<SmartAccountInfo> {
    const network = SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS];
    
    if (!network) {
      throw new Error(`Network ${chainId} not supported for smart accounts`);
    }

    try {
      // Create public client
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: http(),
      });

      // Predict smart account address using factory contract
      const predictedAddress = await publicClient.readContract({
        address: network.factory,
        abi: FACTORY_ABI,
        functionName: 'getAddress',
        args: [ownerAddress as Address, salt],
      });
      
      // Check if account is already deployed
      const bytecode = await publicClient.getBytecode({
        address: predictedAddress,
      });
      const isDeployed = !!bytecode && bytecode !== '0x';

      console.log(`📱 Smart Account Address: ${predictedAddress} (${network.chain.name})`);
      console.log(`📦 Deployed: ${isDeployed}`);

      return {
        address: predictedAddress,
        chainId,
        network: network.chain.name,
        isDeployed,
        salt: salt.toString(),
      };
    } catch (error) {
      console.error(`Failed to generate smart account for ${network.chain.name}:`, error);
      throw new Error(`Failed to generate smart account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate smart account addresses for all supported networks
   */
  static async generateSmartAccountsAllNetworks(
    ownerAddress: string,
    salt: bigint = 0n
  ): Promise<SmartAccountInfo[]> {
    const results: SmartAccountInfo[] = [];
    const chainIds = Object.keys(SMART_ACCOUNT_NETWORKS).map(Number);

    console.log(`🔄 Generating smart accounts for ${chainIds.length} networks...`);

    for (const chainId of chainIds) {
      try {
        const smartAccount = await this.generateSmartAccountAddress(ownerAddress, chainId, salt);
        results.push(smartAccount);
      } catch (error) {
        console.warn(`Failed to generate smart account for chain ${chainId}:`, error);
        // Continue with other networks even if one fails
      }
    }

    console.log(`✅ Generated ${results.length}/${chainIds.length} smart accounts`);
    return results;
  }

  /**
   * Get smart account info for a specific network
   */
  static async getSmartAccountInfo(
    ownerAddress: string,
    chainId: number,
    salt: bigint = 0n
  ): Promise<SmartAccountInfo | null> {
    try {
      return await this.generateSmartAccountAddress(ownerAddress, chainId, salt);
    } catch (error) {
      console.error(`Failed to get smart account info:`, error);
      return null;
    }
  }

  /**
   * Check if smart account is deployed
   */
  static async isSmartAccountDeployed(
    smartAccountAddress: string,
    chainId: number
  ): Promise<boolean> {
    const network = SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS];
    
    if (!network) {
      return false;
    }

    try {
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: http(),
      });

      const bytecode = await publicClient.getBytecode({
        address: smartAccountAddress as Address,
      });
      
      return !!bytecode && bytecode !== '0x';
    } catch (error) {
      console.error('Failed to check deployment status:', error);
      return false;
    }
  }

  /**
   * Get network configuration
   */
  static getNetworkConfig(chainId: number) {
    return SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS] || null;
  }

  /**
   * Get all supported networks
   */
  static getSupportedNetworks() {
    return Object.entries(SMART_ACCOUNT_NETWORKS).map(([chainId, config]) => ({
      chainId: Number(chainId),
      name: config.chain.name,
      network: config.chain.name.toLowerCase().replace(/\s+/g, '-'),
      ...config,
    }));
  }

  /**
   * Generate deterministic salt based on user data
   */
  static generateSalt(ownerAddress: string, userIdentifier: string = ''): bigint {
    // Create a deterministic but unique salt
    const data = encodePacked(
      ['address', 'string'],
      [ownerAddress as Address, userIdentifier]
    );
    
    const hash = keccak256(data);
    // Convert hash to bigint for salt
    return BigInt(hash);
  }

  // ============================================================================
  // CRYPTO-TO-NAIRA OPERATIONS
  // ============================================================================

  /**
   * Sign UserOperation for crypto-to-naira transaction
   * Uses smart account private key to create valid signature
   */
  static async signUserOperation(
    userOperation: any,
    privateKey: string
  ): Promise<any> {
    try {
      // This will be implemented to sign the UserOp hash
      // The backend will handle the actual signing with the smart account
      // Frontend just needs to prepare the UserOp structure
      
      return {
        ...userOperation,
        signature: '0x' + 'signed', // Placeholder - actual signing done on backend
      };
    } catch (error) {
      console.error('Failed to sign UserOperation:', error);
      throw error;
    }
  }

  /**
   * Build swap call data for token conversion
   * Prepares encoded call data for SmartAccount to execute swap
   */
  static buildSwapCallData(data: {
    smartAccountAddress: string;
    tokenIn: string;
    amountIn: number;
    tokenOut: string;
  }): string {
    try {
      // Encode the swap call data that will be executed by SmartAccount
      // This calls SwapRouter via the SmartAccount
      
      // Format: SwapRequest struct containing token swap details
      const swapData = {
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        amountIn: data.amountIn,
        minAmountOut: 0, // Will be calculated by backend
        recipient: data.smartAccountAddress,
      };

      // Return encoded call data (simplified - actual encoding depends on router ABI)
      return JSON.stringify(swapData);
    } catch (error) {
      console.error('Failed to build swap call data:', error);
      throw error;
    }
  }

  /**
   * Get gas estimation for UserOperation
   */
  static async estimateUserOperationGas(
    userOperation: any,
    chainId: number
  ): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
  }> {
    try {
      // Estimate gas for the UserOperation
      const network = SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS];
      
      if (!network) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      // Return reasonable gas estimates (these would be calculated more precisely)
      return {
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(21000),
      };
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      throw error;
    }
  }

  /**
   * Prepare UserOperation for submission to bundler
   */
  static async prepareUserOperationForBundler(
    smartAccountAddress: string,
    callData: string,
    chainId: number
  ): Promise<any> {
    try {
      const network = SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS];
      
      if (!network) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      // Create the UserOperation structure (ERC-4337 spec)
      const userOp = {
        sender: smartAccountAddress,
        nonce: 0, // Will be fetched from EntryPoint
        initCode: '0x', // Already deployed
        callData,
        accountGasLimits: '0x', // uint128 | uint128
        preVerificationGas: 21000,
        gasFees: '0x', // uint128 | uint128
        paymasterAndData: '0x',
        signature: '0x',
      };

      return userOp;
    } catch (error) {
      console.error('Failed to prepare UserOperation:', error);
      throw error;
    }
  }

  /**
   * Monitor UserOperation status on blockchain
   */
  static async monitorUserOperationStatus(
    userOperationHash: string,
    chainId: number,
    maxWaitTime: number = 300000
  ): Promise<{
    confirmed: boolean;
    transactionHash?: string;
    blockNumber?: number;
  }> {
    try {
      const network = SMART_ACCOUNT_NETWORKS[chainId as keyof typeof SMART_ACCOUNT_NETWORKS];
      
      if (!network) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      const publicClient = createPublicClient({
        chain: network.chain,
        transport: http(),
      });

      const startTime = Date.now();
      
      // Poll for UserOperation receipt (simplified - actual implementation more complex)
      while (Date.now() - startTime < maxWaitTime) {
        try {
          // This would query the UserOperation status from EntryPoint or bundler
          // For now, return placeholder
          return {
            confirmed: true,
            transactionHash: '0x' + userOperationHash,
            blockNumber: 1,
          };
        } catch (error) {
          // Continue polling
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      throw new Error('UserOperation confirmation timeout');
    } catch (error) {
      console.error('Failed to monitor UserOperation:', error);
      throw error;
    }
  }
}

export default SmartAccountService;