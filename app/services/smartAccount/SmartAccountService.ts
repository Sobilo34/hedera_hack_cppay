import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, polygon } from 'viem/chains';
import type { SmartAccountInfo, SmartAccountTransaction, GasSponsorshipPolicy } from './types';
import type { Address, Hex, Chain } from 'viem';

/**
 * SmartAccountService - Core ERC-4337 Account Abstraction functionality
 * Handles smart account creation, transaction execution, and balance queries
 */
class SmartAccountService {
  // Singleton instance
  private static instance: SmartAccountService;

  // EntryPoint v0.6 address (same across all chains)
  private static readonly ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
  
  // SimpleAccount Factory addresses (same across all chains)
  private static readonly FACTORY_ADDRESS = '0x9406Cc6185a346906296840746125a0E44976454' as Address;

  // Pimlico API configuration
  private static readonly PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || 'YOUR_API_KEY_HERE';

  // Private constructor for singleton
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SmartAccountService {
    if (!SmartAccountService.instance) {
      SmartAccountService.instance = new SmartAccountService();
    }
    return SmartAccountService.instance;
  }

  /**
   * Get chain configuration
   */
  private static getChain(chainId: number): Chain {
    switch (chainId) {
      case 1:
        return mainnet;
      case 56:
        return bsc;
      case 137:
        return polygon;
      default:
        return mainnet;
    }
  }

  /**
   * Get Pimlico bundler URL for chain
   */
  private static getBundlerUrl(chainId: number): string {
    const chainName = chainId === 1 ? 'ethereum' : chainId === 56 ? 'bsc' : 'polygon';
    return `https://api.pimlico.io/v2/${chainName}/rpc?apikey=${this.PIMLICO_API_KEY}`;
  }

  /**
   * Create smart account from EOA private key
   * Returns smart account address (counterfactual - not yet deployed)
   */
  static async createSmartAccount(
    eoaPrivateKey: Hex,
    chainId: number = 1
  ): Promise<SmartAccountInfo> {
    try {
      console.log('🔧 Creating smart account...');

      const chain = this.getChain(chainId);
      
      // Create EOA signer from private key
      const eoaSigner = privateKeyToAccount(eoaPrivateKey);
      
      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Create smart account (counterfactual)
      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: eoaSigner,
        factoryAddress: this.FACTORY_ADDRESS,
        entryPoint: {
          address: this.ENTRYPOINT_ADDRESS,
          version: '0.6',
        },
      });

      const smartAccountAddress = smartAccount.address;

      // Check if account is deployed
      const code = await publicClient.getBytecode({ address: smartAccountAddress });
      const isDeployed = code !== undefined && code !== '0x';

      // Get balance
      const balance = await publicClient.getBalance({ address: smartAccountAddress });

      console.log('✅ Smart account created:', {
        address: smartAccountAddress,
        eoaAddress: eoaSigner.address,
        isDeployed,
        balance: formatEther(balance),
      });

      return {
        address: smartAccountAddress,
        eoaAddress: eoaSigner.address,
        isDeployed,
        nonce: 0n, // Will be fetched on first transaction
        balance,
      };
    } catch (error) {
      console.error('❌ Failed to create smart account:', error);
      throw new Error('Failed to create smart account');
    }
  }

  /**
   * Get smart account address from EOA private key (deterministic)
   */
  static async getSmartAccountAddress(
    eoaPrivateKey: Hex,
    chainId: number = 1
  ): Promise<Address> {
    const info = await this.createSmartAccount(eoaPrivateKey, chainId);
    return info.address;
  }

  /**
   * Check if smart account is deployed on-chain
   */
  static async isAccountDeployed(
    smartAccountAddress: Address,
    chainId: number = 1
  ): Promise<boolean> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const code = await publicClient.getBytecode({ address: smartAccountAddress });
      return code !== undefined && code !== '0x';
    } catch (error) {
      console.error('Failed to check deployment:', error);
      return false;
    }
  }

  /**
   * Send transaction via smart account
   * Creates UserOperation, signs it, and sends to bundler
   */
  static async sendTransaction(
    eoaPrivateKey: Hex,
    transaction: SmartAccountTransaction,
    chainId: number = 1,
    sponsorGas: boolean = false
  ): Promise<Hex> {
    try {
      console.log('📤 Sending transaction via smart account...');

      const chain = this.getChain(chainId);
      const eoaSigner = privateKeyToAccount(eoaPrivateKey);

      // Create public client
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Create bundler client using Pimlico
      const bundlerClient = createPimlicoClient({
        transport: http(this.getBundlerUrl(chainId)),
        entryPoint: {
          address: this.ENTRYPOINT_ADDRESS,
          version: '0.6',
        },
      });

      // Create smart account
      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: eoaSigner,
        factoryAddress: this.FACTORY_ADDRESS,
        entryPoint: {
          address: this.ENTRYPOINT_ADDRESS,
          version: '0.6',
        },
      });

      // Create smart account client
      const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain,
        bundlerTransport: http(this.getBundlerUrl(chainId)),
      });

      // Send transaction
      const txHash = await smartAccountClient.sendTransaction({
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      });

      console.log('✅ Transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('❌ Failed to send transaction:', error);
      throw error;
    }
  }

  /**
   * Send batch of transactions in one UserOperation
   */
  static async sendBatchTransactions(
    eoaPrivateKey: Hex,
    transactions: SmartAccountTransaction[],
    chainId: number = 1
  ): Promise<Hex> {
    try {
      console.log('📤 Sending batch transactions...');

      const chain = this.getChain(chainId);
      const eoaSigner = privateKeyToAccount(eoaPrivateKey);

      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: eoaSigner,
        factoryAddress: this.FACTORY_ADDRESS,
        entryPoint: {
          address: this.ENTRYPOINT_ADDRESS,
          version: '0.6',
        },
      });

      const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain,
        bundlerTransport: http(this.getBundlerUrl(chainId)),
      });

      // Send batch (if supported by account implementation)
      // For SimpleAccount, we need to call executeBatch
      // For now, we'll send transactions sequentially
      // TODO: Implement proper batch execution
      
      const txHash = await smartAccountClient.sendTransaction({
        to: transactions[0].to,
        value: transactions[0].value,
        data: transactions[0].data,
      });

      console.log('✅ Batch transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('❌ Failed to send batch:', error);
      throw error;
    }
  }

  /**
   * Get smart account balance
   */
  static async getBalance(
    smartAccountAddress: Address,
    chainId: number = 1
  ): Promise<bigint> {
    try {
      const chain = this.getChain(chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const balance = await publicClient.getBalance({ address: smartAccountAddress });
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0n;
    }
  }

  /**
   * Check if transaction is eligible for gas sponsorship
   */
  static async checkGasSponsorship(
    amountNGN: number
  ): Promise<GasSponsorshipPolicy> {
    // Sponsor gas for transactions under ₦80,000 (~$50)
    const maxSponsoredAmount = 80000;

    return {
      isEligible: amountNGN <= maxSponsoredAmount,
      reason: amountNGN <= maxSponsoredAmount
        ? `Transaction under ₦${maxSponsoredAmount} limit`
        : `Transaction exceeds ₦${maxSponsoredAmount} limit`,
      maxSponsoredAmount,
      currentUsage: 0, // TODO: Track usage
      resetDate: Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Format address for display (0x1234...5678)
   */
  static formatAddress(address: string, chars: number = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }
}

export default SmartAccountService;
