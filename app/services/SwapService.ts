/**
 * Swap Service - DEX Aggregation
 * Integrates with 1inch, Paraswap, and backend DEX service
 * 
 * Features:
 * - Get best swap quotes from multiple DEXs
 * - Execute token swaps
 * - Calculate slippage and price impact
 * - Support all 6 tokens: ETH, BNB, LISK, USDT, USDC, CNGN
 */

import axios, { AxiosInstance } from 'axios';
import { Address, Hex, parseUnits, formatUnits } from 'viem';
import BackendApiService from './BackendApiService';

// Environment configuration
const ONE_INCH_API_KEY = process.env.EXPO_PUBLIC_ONE_INCH_API_KEY;
const CHAIN_ID = process.env.EXPO_PUBLIC_CHAIN_ID || '4202'; // Lisk Sepolia

// Token addresses (Lisk Sepolia)
export const TOKEN_ADDRESSES: Record<string, Address> = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address, // Native ETH
  BNB: '0x0000000000000000000000000000000000000000' as Address, // Placeholder
  LISK: '0x0000000000000000000000000000000000000000' as Address, // Native LISK
  USDT: process.env.EXPO_PUBLIC_USDT_ADDRESS as Address,
  USDC: process.env.EXPO_PUBLIC_USDC_ADDRESS as Address,
  CNGN: process.env.EXPO_PUBLIC_CNGN_ADDRESS as Address,
};

export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  BNB: 18,
  LISK: 18,
  USDT: 6,
  USDC: 6,
  CNGN: 18,
};

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  priceImpact: number;
  slippage: number;
  route: string[];
  dex: string;
  callData?: Hex;
  minAmountOut?: string;
}

export interface SwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number; // percentage (e.g., 0.5 for 0.5%)
  userAddress: Address;
}

class SwapService {
  private oneInchClient: AxiosInstance;

  constructor() {
    // 1inch API client
    this.oneInchClient = axios.create({
      baseURL: `https://api.1inch.dev/swap/v5.2/${CHAIN_ID}`,
      headers: {
        Authorization: `Bearer ${ONE_INCH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.oneInchClient.interceptors.request.use((config) => {
      console.log('📤 1inch Request:', config.method?.toUpperCase(), config.url);
      return config;
    });

    this.oneInchClient.interceptors.response.use(
      (response) => {
        console.log('✅ 1inch Response:', response.status);
        return response;
      },
      (error) => {
        console.error('❌ 1inch Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get best swap quote from multiple sources
   */
  async getBestQuote(params: SwapParams): Promise<SwapQuote> {
    console.log('🔍 Getting best swap quote...', params);

    try {
      // Try multiple sources in parallel
      const [oneInchQuote, backendQuote] = await Promise.allSettled([
        this.get1inchQuote(params),
        this.getBackendQuote(params),
      ]);

      // Compare quotes and return the best one
      const quotes: SwapQuote[] = [];

      if (oneInchQuote.status === 'fulfilled' && oneInchQuote.value) {
        quotes.push(oneInchQuote.value);
      }

      if (backendQuote.status === 'fulfilled' && backendQuote.value) {
        quotes.push(backendQuote.value);
      }

      if (quotes.length === 0) {
        throw new Error('No swap quotes available');
      }

      // Return quote with highest output amount
      const bestQuote = quotes.reduce((best, current) => {
        const bestAmount = parseFloat(best.toAmount);
        const currentAmount = parseFloat(current.toAmount);
        return currentAmount > bestAmount ? current : best;
      });

      console.log('✅ Best quote:', bestQuote);
      return bestQuote;
    } catch (error: any) {
      console.error('❌ Failed to get best quote:', error);
      throw error;
    }
  }

  /**
   * Get quote from 1inch
   */
  private async get1inchQuote(params: SwapParams): Promise<SwapQuote | null> {
    try {
      const fromTokenAddress = TOKEN_ADDRESSES[params.fromToken];
      const toTokenAddress = TOKEN_ADDRESSES[params.toToken];
      const fromDecimals = TOKEN_DECIMALS[params.fromToken];

      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error('Invalid token');
      }

      // Convert amount to smallest unit
      const amount = parseUnits(params.amount, fromDecimals).toString();

      // Get quote
      const response = await this.oneInchClient.get('/quote', {
        params: {
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount,
          includeGas: true,
        },
      });

      const data = response.data;
      const toDecimals = TOKEN_DECIMALS[params.toToken];

      return {
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.amount,
        toAmount: formatUnits(BigInt(data.toAmount), toDecimals),
        estimatedGas: data.estimatedGas || '300000',
        priceImpact: parseFloat(data.priceImpact || '0'),
        slippage: params.slippage || 0.5,
        route: data.protocols?.[0]?.[0]?.name ? [data.protocols[0][0].name] : ['1inch'],
        dex: '1inch',
      };
    } catch (error: any) {
      console.warn('⚠️ 1inch quote failed:', error.message);
      return null;
    }
  }

  /**
   * Get quote from backend DEX service
   */
  private async getBackendQuote(params: SwapParams): Promise<SwapQuote | null> {
    try {
      const response: any = await BackendApiService.getBestSwapQuote({
        from_token: params.fromToken,
        to_token: params.toToken,
        amount: params.amount,
        network: 'lisk-sepolia',
      });

      return {
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.amount,
        toAmount: response.estimated_output,
        estimatedGas: response.estimated_gas?.toString() || '300000',
        priceImpact: response.price_impact || 0,
        slippage: params.slippage || 0.5,
        route: response.route || [response.best_dex],
        dex: response.best_dex,
        callData: response.call_data as Hex,
      };
    } catch (error: any) {
      console.warn('⚠️ Backend quote failed:', error.message);
      return null;
    }
  }

  /**
   * Get swap transaction data from 1inch
   */
  async get1inchSwapData(
    params: SwapParams
  ): Promise<{ to: Address; data: Hex; value: string }> {
    try {
      const fromTokenAddress = TOKEN_ADDRESSES[params.fromToken];
      const toTokenAddress = TOKEN_ADDRESSES[params.toToken];
      const fromDecimals = TOKEN_DECIMALS[params.fromToken];

      const amount = parseUnits(params.amount, fromDecimals).toString();
      const slippage = params.slippage || 0.5;

      const response = await this.oneInchClient.get('/swap', {
        params: {
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount,
          from: params.userAddress,
          slippage,
          disableEstimate: true,
        },
      });

      return {
        to: response.data.tx.to,
        data: response.data.tx.data,
        value: response.data.tx.value || '0',
      };
    } catch (error: any) {
      console.error('❌ Failed to get 1inch swap data:', error);
      throw error;
    }
  }

  /**
   * Calculate minimum amount out with slippage
   */
  calculateMinAmountOut(expectedAmount: string, slippagePercent: number, decimals: number): string {
    const amount = parseUnits(expectedAmount, decimals);
    const slippageFactor = BigInt(Math.floor((100 - slippagePercent) * 100));
    const minAmount = (amount * slippageFactor) / 10000n;
    return formatUnits(minAmount, decimals);
  }

  /**
   * Calculate price impact
   */
  calculatePriceImpact(
    fromAmount: string,
    toAmount: string,
    fromPrice: number,
    toPrice: number
  ): number {
    const fromValue = parseFloat(fromAmount) * fromPrice;
    const toValue = parseFloat(toAmount) * toPrice;
    const impact = ((fromValue - toValue) / fromValue) * 100;
    return Math.max(0, impact);
  }

  /**
   * Check if swap is safe (low price impact)
   */
  isSwapSafe(quote: SwapQuote): { safe: boolean; reason?: string } {
    if (quote.priceImpact > 5) {
      return {
        safe: false,
        reason: `High price impact: ${quote.priceImpact.toFixed(2)}%`,
      };
    }

    if (quote.slippage > 2) {
      return {
        safe: false,
        reason: `High slippage: ${quote.slippage}%`,
      };
    }

    return { safe: true };
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens(): string[] {
    return Object.keys(TOKEN_ADDRESSES);
  }

  /**
   * Validate swap parameters
   */
  validateSwapParams(params: SwapParams): { valid: boolean; error?: string } {
    if (!TOKEN_ADDRESSES[params.fromToken]) {
      return { valid: false, error: `Unsupported token: ${params.fromToken}` };
    }

    if (!TOKEN_ADDRESSES[params.toToken]) {
      return { valid: false, error: `Unsupported token: ${params.toToken}` };
    }

    if (params.fromToken === params.toToken) {
      return { valid: false, error: 'Cannot swap same token' };
    }

    const amount = parseFloat(params.amount);
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    return { valid: true };
  }

  /**
   * Format swap summary for display
   */
  formatSwapSummary(quote: SwapQuote): string {
    return `
Swap ${quote.fromAmount} ${quote.fromToken} → ${quote.toAmount} ${quote.toToken}
DEX: ${quote.dex}
Route: ${quote.route.join(' → ')}
Price Impact: ${quote.priceImpact.toFixed(2)}%
Slippage: ${quote.slippage}%
Estimated Gas: ${quote.estimatedGas}
    `.trim();
  }
}

export default new SwapService();
