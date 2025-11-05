/**
 * Feature 6: Token Swap Service
 * Exchange between any of the 6 supported tokens
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import SwapService, { TOKEN_ADDRESSES, TOKEN_DECIMALS } from '../SwapService';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';

export interface TokenSwapParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  fromToken: string;
  toToken: string;
  amount: string; // Amount of fromToken
  slippage?: number; // Default 0.5%
  maxPriceImpact?: number; // Default 5%
}

export interface TokenSwapResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  dexUsed: string;
  estimatedTime: number;
  error?: string;
}

class TokenSwapService {
  /**
   * Swap tokens using DEX aggregation
   * 
   * Flow:
   * 1. Get best swap quote from multiple DEXes
   * 2. Validate price impact and slippage
   * 3. Get swap transaction data
   * 4. Create UserOperation for swap
   * 5. Submit to bundler
   * 6. Wait for confirmation
   */
  static async swapTokens(
    params: TokenSwapParams
  ): Promise<TokenSwapResult> {
    try {
      console.log('🔄 Starting token swap...', {
        from: params.fromToken,
        to: params.toToken,
        amount: params.amount,
      });

      const slippage = params.slippage || 0.5;
      const maxPriceImpact = params.maxPriceImpact || 5;

      // Step 1: Validate swap parameters
      const validation = SwapService.validateSwapParams({
        fromToken: params.fromToken,
        toToken: params.toToken,
        amount: params.amount,
        slippage,
        userAddress: params.smartWalletAddress,
      });

      if (!validation.valid) {
        return {
          success: false,
          fromAmount: params.amount,
          toAmount: '0',
          priceImpact: 0,
          dexUsed: '',
          estimatedTime: 0,
          error: validation.error,
        };
      }

      // Step 2: Get best swap quote
      console.log('💡 Step 1: Getting best swap quote...');
      const quote = await SwapService.getBestQuote({
        fromToken: params.fromToken,
        toToken: params.toToken,
        amount: params.amount,
        slippage,
        userAddress: params.smartWalletAddress,
      });

      console.log('✅ Quote received:', SwapService.formatSwapSummary(quote));

      // Step 3: Validate swap safety
      const safety = SwapService.isSwapSafe(quote);
      if (!safety.safe) {
        return {
          success: false,
          fromAmount: params.amount,
          toAmount: quote.toAmount,
          priceImpact: quote.priceImpact,
          dexUsed: quote.dex,
          estimatedTime: 0,
          error: safety.reason,
        };
      }

      // Additional price impact check
      if (quote.priceImpact > maxPriceImpact) {
        return {
          success: false,
          fromAmount: params.amount,
          toAmount: quote.toAmount,
          priceImpact: quote.priceImpact,
          dexUsed: quote.dex,
          estimatedTime: 0,
          error: `Price impact too high: ${quote.priceImpact.toFixed(2)}%`,
        };
      }

      // Step 4: Get swap transaction data
      console.log('🔨 Step 2: Getting swap transaction data...');
      const swapData = await SwapService.get1inchSwapData({
        fromToken: params.fromToken,
        toToken: params.toToken,
        amount: params.amount,
        slippage,
        userAddress: params.smartWalletAddress,
      });

      console.log('✅ Swap data received');

      // Step 5: Create UserOperation for swap
      console.log('🔨 Step 3: Creating UserOperation for swap...');
      
      const toTokenDecimals = TOKEN_DECIMALS[params.toToken];
      const minAmountOut = parseUnits(
        SwapService.calculateMinAmountOut(quote.toAmount, slippage, toTokenDecimals),
        toTokenDecimals
      );

      const userOp = await AccountAbstractionService.createSwapAndTransferOp(
        params.smartWalletAddress,
        params.privateKey,
        swapData.data,
        swapData.to,
        params.smartWalletAddress, // Send result back to user
        minAmountOut
      );

      console.log('✅ UserOperation created');

      // Step 6: Submit UserOperation to bundler
      console.log('📤 Step 4: Submitting UserOperation to bundler...');
      const userOpHash = await BundlerService.sendUserOperation(userOp);
      console.log('✅ UserOperation submitted:', userOpHash);

      // Step 7: Wait for UserOperation confirmation
      console.log('⏳ Step 5: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ Token swap completed successfully!', {
          txHash: status.transactionHash,
          from: params.fromToken,
          to: params.toToken,
        });

        return {
          success: true,
          transactionHash: status.transactionHash,
          userOpHash,
          fromAmount: params.amount,
          toAmount: quote.toAmount,
          priceImpact: quote.priceImpact,
          dexUsed: quote.dex,
          estimatedTime: 30,
        };
      } else {
        console.error('❌ Transaction failed:', status.error);
        return {
          success: false,
          userOpHash,
          fromAmount: params.amount,
          toAmount: quote.toAmount,
          priceImpact: quote.priceImpact,
          dexUsed: quote.dex,
          estimatedTime: 0,
          error: status.error || 'Transaction failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Token swap failed:', error);
      return {
        success: false,
        fromAmount: params.amount,
        toAmount: '0',
        priceImpact: 0,
        dexUsed: '',
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get swap quote without executing
   */
  static async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    userAddress: Address
  ): Promise<{
    toAmount: string;
    priceImpact: number;
    slippage: number;
    dex: string;
    route: string[];
    estimatedGas: string;
  }> {
    try {
      const quote = await SwapService.getBestQuote({
        fromToken,
        toToken,
        amount,
        slippage: 0.5,
        userAddress,
      });

      return {
        toAmount: quote.toAmount,
        priceImpact: quote.priceImpact,
        slippage: quote.slippage,
        dex: quote.dex,
        route: quote.route,
        estimatedGas: quote.estimatedGas,
      };
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  /**
   * Get supported token pairs
   */
  static getSupportedPairs(): { from: string; to: string }[] {
    const tokens = SwapService.getSupportedTokens();
    const pairs: { from: string; to: string }[] = [];

    for (const from of tokens) {
      for (const to of tokens) {
        if (from !== to) {
          pairs.push({ from, to });
        }
      }
    }

    return pairs;
  }

  /**
   * Calculate expected output for a given input
   */
  static async calculateOutput(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    userAddress: Address
  ): Promise<string> {
    const quote = await this.getQuote(fromToken, toToken, fromAmount, userAddress);
    return quote.toAmount;
  }
}

export default TokenSwapService;
