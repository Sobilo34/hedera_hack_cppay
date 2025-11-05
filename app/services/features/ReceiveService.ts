/**
 * Feature 8: Receive Service
 * Display wallet address, QR code, balances for receiving payments
 */

import type { Address } from 'viem';
import { formatUnits } from 'viem';
import BackendApiService from '../BackendApiService';

export interface ReceiveInfo {
  walletAddress: Address;
  qrCodeData: string; // Address as string for QR generation
  formattedAddress: string; // 0x1234...5678
  balances: TokenBalance[];
  network: string;
  chainId: number;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string; // Formatted with decimals
  balanceRaw: bigint;
  decimals: number;
  usdValue?: number;
  ngnValue?: number;
  tokenAddress?: Address;
}

export interface RecentTransaction {
  hash: string;
  type: 'received' | 'sent';
  token: string;
  amount: string;
  from: Address;
  to: Address;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

class ReceiveService {
  /**
   * Get wallet receive information
   */
  static async getReceiveInfo(
    walletAddress: Address
  ): Promise<ReceiveInfo> {
    const balances = await this.getAllBalances(walletAddress);

    return {
      walletAddress,
      qrCodeData: walletAddress, // Used by QR code library
      formattedAddress: this.formatAddress(walletAddress),
      balances,
      network: 'Lisk Sepolia',
      chainId: 4202,
    };
  }

  /**
   * Format address for display (0x1234...5678)
   */
  static formatAddress(address: Address): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get all token balances
   */
  static async getAllBalances(walletAddress: Address): Promise<TokenBalance[]> {
    try {
      // TODO: Implement backend API call when endpoint is ready
      // const response = await BackendApiService.getAccountBalances(walletAddress);
      
      // For now, return default balances
      // In production, this would fetch real balances from blockchain
      return this.getDefaultBalances();
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      return this.getDefaultBalances();
    }
  }

  /**
   * Get default balances (all zero)
   */
  private static getDefaultBalances(): TokenBalance[] {
    const tokens = [
      { symbol: 'ETH', decimals: 18, address: undefined },
      { symbol: 'BNB', decimals: 18, address: '0x0000000000000000000000000000000000000001' as Address },
      { symbol: 'LISK', decimals: 18, address: '0x0000000000000000000000000000000000000002' as Address },
      { symbol: 'USDT', decimals: 6, address: '0x0000000000000000000000000000000000000003' as Address },
      { symbol: 'USDC', decimals: 6, address: '0x0000000000000000000000000000000000000004' as Address },
      { symbol: 'CNGN', decimals: 18, address: '0x0000000000000000000000000000000000000005' as Address },
    ];

    return tokens.map(t => ({
      token: t.symbol,
      symbol: t.symbol,
      balance: '0',
      balanceRaw: BigInt(0),
      decimals: t.decimals,
      usdValue: 0,
      ngnValue: 0,
      tokenAddress: t.address,
    }));
  }

  /**
   * Get recent transactions
   */
  static async getRecentTransactions(
    walletAddress: Address,
    limit: number = 10
  ): Promise<RecentTransaction[]> {
    try {
      // This would call backend API
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  /**
   * Get shareable text for wallet address
   */
  static getShareText(walletAddress: Address, network: string = 'Lisk Sepolia'): string {
    return `Send crypto to my CPPay wallet:\n\nAddress: ${walletAddress}\nNetwork: ${network}\n\nSupported tokens: ETH, BNB, LISK, USDT, USDC, CNGN`;
  }

  /**
   * Validate if address is a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Copy address to clipboard (for React Native)
   */
  static async copyToClipboard(address: Address): Promise<boolean> {
    try {
      // In React Native, use Clipboard from @react-native-clipboard/clipboard
      // For now, just return true
      console.log('Address copied:', address);
      return true;
    } catch (error) {
      console.error('Failed to copy address:', error);
      return false;
    }
  }

  /**
   * Generate payment request URI (EIP-681)
   * Example: ethereum:0x1234...@4202?value=1e18
   */
  static generatePaymentURI(
    walletAddress: Address,
    token?: string,
    amount?: string,
    chainId: number = 4202
  ): string {
    let uri = `ethereum:${walletAddress}@${chainId}`;
    
    if (token && token !== 'ETH') {
      // For ERC-20 tokens, include token address
      uri += `/transfer?address=${token}`;
    }
    
    if (amount) {
      uri += uri.includes('?') ? '&' : '?';
      uri += `value=${amount}`;
    }

    return uri;
  }

  /**
   * Format balance with proper decimals
   */
  static formatBalance(balance: bigint, decimals: number, maxDecimals: number = 4): string {
    const formatted = formatUnits(balance, decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    
    return num.toFixed(maxDecimals).replace(/\.?0+$/, '');
  }

  /**
   * Get total portfolio value in NGN
   */
  static calculateTotalValue(balances: TokenBalance[]): {
    totalNGN: number;
    totalUSD: number;
  } {
    const totalNGN = balances.reduce((sum, b) => sum + (b.ngnValue || 0), 0);
    const totalUSD = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0);

    return { totalNGN, totalUSD };
  }

  /**
   * Check if wallet has received any funds
   */
  static async hasReceivedFunds(walletAddress: Address): Promise<boolean> {
    const balances = await this.getAllBalances(walletAddress);
    return balances.some(b => b.balanceRaw > BigInt(0));
  }
}

export default ReceiveService;
