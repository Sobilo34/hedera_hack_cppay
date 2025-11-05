import * as bip39 from 'bip39';
import { 
  mnemonicToAccount, 
  privateKeyToAccount
} from 'viem/accounts';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { mainnet, bsc, polygon } from 'viem/chains';
import { NetworkConfig, TokenBalance } from '@/types/wallet';
import { Buffer } from 'buffer';
import SmartAccountService from './smartAccount/SmartAccountService';
import SecureWalletStorage from './SecureWalletStorage';

/**
 * WalletService - Core cryptocurrency wallet functionality using Viem
 * Handles wallet creation, import, and blockchain interactions
 */
class WalletService {
  // Default networks configuration
  static readonly DEFAULT_NETWORKS: NetworkConfig[] = [
    {
      chainId: 1,
      name: 'Ethereum Mainnet',
      symbol: 'ETH',
      rpcUrl: 'https://eth.llamarpc.com',
      blockExplorer: 'https://etherscan.io',
      iconUrl: 'eth-icon.png',
      enabled: true,
    },
    {
      chainId: 56,
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      rpcUrl: 'https://bsc-dataseed.binance.org',
      blockExplorer: 'https://bscscan.com',
      iconUrl: 'bnb-icon.png',
      enabled: true,
    },
    {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorer: 'https://polygonscan.com',
      iconUrl: 'matic-icon.png',
      enabled: true,
    },
  ];

  /**
   * Generate new BIP39 mnemonic (12 words)
   */
  static generateMnemonic(): string {
    try {
      console.log('🔑 Generating mnemonic...');
      
      // Generate 128 bits of entropy = 12 words
      const mnemonic = bip39.generateMnemonic(128);
      console.log('✅ Generated mnemonic:', mnemonic.split(' ').length, 'words');
      return mnemonic;
    } catch (error) {
      console.error('❌ Error generating mnemonic:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Validate BIP39 mnemonic
   */
  static validateMnemonic(mnemonic: string): boolean {
    try {
      return bip39.validateMnemonic(mnemonic);
    } catch (error) {
      console.error('❌ Error validating mnemonic:', error);
      return false;
    }
  }

  /**
   * Create new wallet from mnemonic using viem
   */
  static createWalletFromMnemonic(mnemonic: string): {
    address: string;
    privateKey: string;
    mnemonic: string;
  } {
    try {
      if (!this.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Create account from mnemonic using viem
      const account = mnemonicToAccount(mnemonic);
      const hdKey = account.getHdKey();

      console.log('✅ Wallet created from mnemonic:', {
        address: account.address,
        mnemonicWords: mnemonic.split(' ').length
      });

      return {
        address: account.address,
        privateKey: `0x${Buffer.from(hdKey.privateKey!).toString('hex')}`,
        mnemonic: mnemonic,
      };
    } catch (error) {
      console.error('❌ Error creating wallet from mnemonic:', error);
      throw new Error('Failed to create wallet from mnemonic');
    }
  }

  /**
   * Import wallet from private key using viem
   */
  static importWalletFromPrivateKey(privateKey: string): {
    address: string;
    privateKey: string;
  } {
    try {
      // Remove 0x prefix if present
      const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      
      // Create account from private key
      const account = privateKeyToAccount(cleanKey as `0x${string}`);

      console.log('✅ Wallet imported from private key:', account.address);

      return {
        address: account.address,
        privateKey: cleanKey,
      };
    } catch (error) {
      console.error('❌ Error importing wallet from private key:', error);
      throw new Error('Invalid private key');
    }
  }

  /**
   * Import wallet from mnemonic (alias for createWalletFromMnemonic)
   */
  static importWalletFromMnemonic(mnemonic: string): {
    address: string;
    privateKey: string;
    mnemonic: string;
  } {
    return this.createWalletFromMnemonic(mnemonic);
  }

  /**
   * Create smart account from EOA private key
   * This generates a counterfactual address (deterministic, but not yet deployed)
   */
  static async createSmartAccountFromSigner(
    eoaPrivateKey: string,
    chainId: number = 1
  ): Promise<{
    smartAccountAddress: string;
    isDeployed: boolean;
  }> {
    try {
      console.log('🔧 Creating smart account from EOA signer...');
      
      const smartAccountInfo = await SmartAccountService.createSmartAccount(
        eoaPrivateKey as `0x${string}`,
        chainId
      );

      // Store smart account address
      await SecureWalletStorage.storeSmartAccountAddress(smartAccountInfo.address);
      await SecureWalletStorage.setSmartAccountDeployed(smartAccountInfo.isDeployed);

      console.log('✅ Smart account created:', {
        address: smartAccountInfo.address,
        isDeployed: smartAccountInfo.isDeployed,
        chainId
      });

      return {
        smartAccountAddress: smartAccountInfo.address,
        isDeployed: smartAccountInfo.isDeployed,
      };
    } catch (error) {
      console.error('❌ Error creating smart account:', error);
      throw new Error('Failed to create smart account');
    }
  }

  /**
   * Deploy smart account on-chain
   * This sends the first UserOperation which triggers deployment
   */
  static async deploySmartAccount(
    eoaPrivateKey: string,
    chainId: number = 1
  ): Promise<string> {
    try {
      console.log('🚀 Deploying smart account on-chain...');
      
      // Send a dummy transaction to trigger deployment
      // The bundler will deploy the account as part of the first UserOp
      const userOpHash = await SmartAccountService.sendTransaction(
        eoaPrivateKey as `0x${string}`,
        {
          to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          value: 0n,
          data: '0x' as `0x${string}`,
        },
        chainId,
        false // Don't sponsor this deployment transaction
      );

      // Mark as deployed
      await SecureWalletStorage.setSmartAccountDeployed(true);

      console.log('✅ Smart account deployed! UserOp hash:', userOpHash);
      
      return userOpHash;
    } catch (error) {
      console.error('❌ Error deploying smart account:', error);
      throw new Error('Failed to deploy smart account');
    }
  }

  /**
   * Check if smart account is deployed on-chain
   */
  static async isSmartAccountDeployed(
    smartAccountAddress: string,
    chainId: number = 1
  ): Promise<boolean> {
    try {
      return await SmartAccountService.isAccountDeployed(
        smartAccountAddress as `0x${string}`,
        chainId
      );
    } catch (error) {
      console.error('❌ Error checking smart account deployment:', error);
      return false;
    }
  }

  /**
   * Get native token balance for an address
   */
  static async getNativeBalance(
    address: string,
    network: NetworkConfig
  ): Promise<string> {
    try {
      const client = createPublicClient({
        chain: this.getChainConfig(network.chainId),
        transport: http(network.rpcUrl),
      });

      const balance = await client.getBalance({
        address: address as `0x${string}`,
      });

      return formatEther(balance);
    } catch (error) {
      console.error(`❌ Error fetching balance for ${network.name}:`, error);
      return '0';
    }
  }

  /**
   * Get ERC20 token balance
   */
  static async getTokenBalance(
    address: string,
    tokenAddress: string,
    decimals: number,
    network: NetworkConfig
  ): Promise<string> {
    try {
      const client = createPublicClient({
        chain: this.getChainConfig(network.chainId),
        transport: http(network.rpcUrl),
      });

      // ERC20 balanceOf ABI
      const balance = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      // Format balance with decimals
      const balanceStr = balance.toString();
      const divisor = BigInt(10) ** BigInt(decimals);
      const formattedBalance = Number(BigInt(balanceStr) / divisor);

      return formattedBalance.toString();
    } catch (error) {
      console.error(`❌ Error fetching token balance:`, error);
      return '0';
    }
  }

  /**
   * Fetch all token balances for an address across multiple networks
   */
  static async fetchAllBalances(
    address: string,
    networks: NetworkConfig[],
    pricesMap: { [symbol: string]: { usd: number; ngn: number } }
  ): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const network of networks) {
      if (!network.enabled) continue;

      try {
        // Get native token balance
        const nativeBalance = await this.getNativeBalance(address, network);
        const nativePrice = pricesMap[network.symbol] || { usd: 0, ngn: 0 };

        balances.push({
          symbol: network.symbol,
          name: network.name,
          balance: nativeBalance,
          decimals: 18,
          chain: network.name,
          logoUrl: network.iconUrl,
          priceUsd: nativePrice.usd,
          priceNgn: nativePrice.ngn,
          chainId: network.chainId,
        });
      } catch (error) {
        console.error(`Failed to fetch balance for ${network.name}:`, error);
      }
    }

    return balances;
  }

  /**
   * Get chain configuration for viem
   */
  private static getChainConfig(chainId: number) {
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
   * Format address for display (0x1234...5678)
   */
  static formatAddress(address: string, chars: number = 4): string {
    if (!address) return '';
    return `${address.substring(0, chars + 2)}...${address.substring(
      address.length - chars
    )}`;
  }

  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Convert value to Wei (for native tokens)
   */
  static toWei(amount: string): bigint {
    return parseEther(amount);
  }

  /**
   * Convert Wei to Ether
   */
  static fromWei(wei: bigint): string {
    return formatEther(wei);
  }
}

export default WalletService;
