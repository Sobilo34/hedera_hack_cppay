import PriceService from './PriceService';

/**
 * SwapCalculator - Calculates crypto-to-cNGN swap amounts for payments
 * Handles all swap-related calculations for the CPPay app
 */

export interface SwapQuote {
  fromToken: string;        // Token user is spending (e.g., 'USDT')
  toToken: string;          // Always 'cNGN' for our use case
  fromAmount: string;       // Amount user needs to spend
  toAmount: string;         // Amount of cNGN user receives (1:1 with NGN)
  priceImpact: number;      // Estimated slippage percentage
  route: string[];          // Swap route (e.g., ['USDT', 'cNGN'])
  totalCostNGN: number;     // Total cost in NGN
  exchangeRate: number;     // Token price in NGN
}

export interface BestTokenOption {
  token: string;
  amount: string;
  cost: number;
  sufficient: boolean;
  reason: string;
}

class SwapCalculator {
  private static readonly SLIPPAGE_TOLERANCE = 0.005; // 0.5%
  private static readonly DEX_FEE = 0.003; // 0.3% (Uniswap standard)
  
  /**
   * Calculate how much crypto is needed to get desired cNGN amount
   * Example: User wants to send ₦10,000 → How much USDT needed?
   * 
   * @param desiredNGN - Amount in Naira (e.g., 10000 for ₦10,000)
   * @param fromToken - Token symbol to spend (e.g., 'USDT', 'ETH')
   * @returns Swap quote with amount needed
   */
  static async calculateCryptoNeeded(
    desiredNGN: number,
    fromToken: string
  ): Promise<SwapQuote> {
    // Get token price in NGN
    const tokenPrice = await PriceService.fetchTokenPrice(fromToken);
    
    if (!tokenPrice || tokenPrice.ngn === 0) {
      throw new Error(`Unable to fetch price for ${fromToken}`);
    }

    // cNGN is 1:1 with NGN
    const cNGNNeeded = desiredNGN;
    
    // Calculate base crypto amount needed
    // Example: Need ₦10,000, USDT = ₦1,600/USDT
    //          Base amount: 10,000 / 1,600 = 6.25 USDT
    const baseAmount = desiredNGN / tokenPrice.ngn;
    
    // Add DEX fee (0.3%)
    const amountWithFee = baseAmount * (1 + this.DEX_FEE);
    
    // Add slippage tolerance (0.5%)
    const finalAmount = amountWithFee * (1 + this.SLIPPAGE_TOLERANCE);
    
    // Calculate price impact (simplified)
    const priceImpact = (this.DEX_FEE + this.SLIPPAGE_TOLERANCE) * 100;
    
    return {
      fromToken: fromToken.toUpperCase(),
      toToken: 'cNGN',
      fromAmount: finalAmount.toFixed(6),
      toAmount: cNGNNeeded.toString(),
      priceImpact,
      route: [fromToken.toUpperCase(), 'cNGN'],
      totalCostNGN: finalAmount * tokenPrice.ngn,
      exchangeRate: tokenPrice.ngn,
    };
  }

  /**
   * Calculate how much NGN user can get from their crypto
   * Example: User has 100 USDT → How much ₦ can they send?
   * 
   * @param cryptoAmount - Amount of crypto (e.g., 100 USDT)
   * @param fromToken - Token symbol (e.g., 'USDT')
   * @returns Amount in NGN and cNGN after fees
   */
  static async calculateNGNFromCrypto(
    cryptoAmount: number,
    fromToken: string
  ): Promise<{
    ngnAmount: number;
    cNGNAmount: number;
    pricePerToken: number;
    fees: {
      dexFee: number;
      slippage: number;
      total: number;
    };
  }> {
    // Get token price in NGN
    const tokenPrice = await PriceService.fetchTokenPrice(fromToken);
    
    if (!tokenPrice || tokenPrice.ngn === 0) {
      throw new Error(`Unable to fetch price for ${fromToken}`);
    }

    // Calculate base NGN value
    const baseValue = cryptoAmount * tokenPrice.ngn;
    
    // Subtract DEX fee (0.3%)
    const dexFee = baseValue * this.DEX_FEE;
    const afterDexFee = baseValue - dexFee;
    
    // Subtract slippage (0.5%)
    const slippageLoss = afterDexFee * this.SLIPPAGE_TOLERANCE;
    const finalNGN = afterDexFee - slippageLoss;
    
    return {
      ngnAmount: finalNGN,
      cNGNAmount: finalNGN, // 1:1 with NGN
      pricePerToken: tokenPrice.ngn,
      fees: {
        dexFee,
        slippage: slippageLoss,
        total: dexFee + slippageLoss,
      },
    };
  }

  /**
   * Get best token to use for a transaction based on user's balances
   * 
   * @param desiredNGN - Amount in NGN user wants to send
   * @param userBalances - Object with token symbols as keys and amounts as values
   * @returns Best token option with reasoning
   */
  static async getBestTokenForTransaction(
    desiredNGN: number,
    userBalances: { [token: string]: number }
  ): Promise<BestTokenOption> {
    const quotes: Array<{
      token: string;
      amount: string;
      cost: number;
      sufficient: boolean;
      exchangeRate: number;
    }> = [];

    // Calculate quotes for each token user has
    for (const [token, balance] of Object.entries(userBalances)) {
      if (balance > 0) {
        try {
          const quote = await this.calculateCryptoNeeded(desiredNGN, token);
          const amountNeeded = parseFloat(quote.fromAmount);
          
          quotes.push({
            token,
            amount: quote.fromAmount,
            cost: quote.totalCostNGN,
            sufficient: balance >= amountNeeded,
            exchangeRate: quote.exchangeRate,
          });
        } catch (error) {
          console.error(`Error calculating quote for ${token}:`, error);
        }
      }
    }

    if (quotes.length === 0) {
      throw new Error('No tokens available for transaction');
    }

    // Sort by: 1. Sufficient balance, 2. Lowest cost
    quotes.sort((a, b) => {
      if (a.sufficient && !b.sufficient) return -1;
      if (!a.sufficient && b.sufficient) return 1;
      return a.cost - b.cost;
    });

    const best = quotes[0];
    
    // Determine reason
    let reason: string;
    if (best.sufficient) {
      // Check if stablecoin (best for payments)
      if (['USDT', 'USDC', 'DAI'].includes(best.token.toUpperCase())) {
        reason = 'Stablecoin - lowest price volatility';
      } else {
        reason = 'Lowest cost option';
      }
    } else {
      reason = 'Insufficient balance in all tokens';
    }

    return {
      token: best.token,
      amount: best.amount,
      cost: best.cost,
      sufficient: best.sufficient,
      reason,
    };
  }

  /**
   * Calculate transaction breakdown for display
   * Shows user exactly what they're paying and receiving
   * 
   * @param desiredNGN - Amount in NGN
   * @param fromToken - Token to spend
   * @returns Detailed breakdown
   */
  static async getTransactionBreakdown(
    desiredNGN: number,
    fromToken: string
  ): Promise<{
    sending: {
      amount: string;
      token: string;
      valueNGN: number;
    };
    receiving: {
      amount: number;
      token: string;
      valueNGN: number;
    };
    fees: {
      dexFee: string;
      networkFee: string;
      total: string;
    };
    exchangeRate: string;
  }> {
    const quote = await this.calculateCryptoNeeded(desiredNGN, fromToken);
    const tokenPrice = await PriceService.fetchTokenPrice(fromToken);
    
    const sendingAmount = parseFloat(quote.fromAmount);
    const dexFeeAmount = sendingAmount * this.DEX_FEE;
    
    return {
      sending: {
        amount: quote.fromAmount,
        token: fromToken.toUpperCase(),
        valueNGN: quote.totalCostNGN,
      },
      receiving: {
        amount: desiredNGN,
        token: 'cNGN',
        valueNGN: desiredNGN,
      },
      fees: {
        dexFee: `${(this.DEX_FEE * 100).toFixed(2)}%`,
        networkFee: 'Sponsored', // Account Abstraction benefit
        total: `${dexFeeAmount.toFixed(6)} ${fromToken.toUpperCase()}`,
      },
      exchangeRate: `1 ${fromToken.toUpperCase()} = ₦${tokenPrice.ngn.toLocaleString()}`,
    };
  }

  /**
   * Validate if user has sufficient balance for transaction
   * 
   * @param desiredNGN - Amount in NGN
   * @param fromToken - Token to spend
   * @param userBalance - User's current balance of the token
   * @returns Validation result
   */
  static async validateSufficientBalance(
    desiredNGN: number,
    fromToken: string,
    userBalance: number
  ): Promise<{
    sufficient: boolean;
    required: number;
    shortfall: number;
    message: string;
  }> {
    const quote = await this.calculateCryptoNeeded(desiredNGN, fromToken);
    const required = parseFloat(quote.fromAmount);
    const sufficient = userBalance >= required;
    const shortfall = sufficient ? 0 : required - userBalance;

    let message: string;
    if (sufficient) {
      message = `You have enough ${fromToken.toUpperCase()} for this transaction`;
    } else {
      message = `Insufficient ${fromToken.toUpperCase()}. You need ${shortfall.toFixed(6)} more`;
    }

    return {
      sufficient,
      required,
      shortfall,
      message,
    };
  }

  /**
   * Get minimum and maximum transaction amounts based on liquidity
   * 
   * @param fromToken - Token symbol
   * @returns Min and max amounts in NGN
   */
  static async getTransactionLimits(
    fromToken: string
  ): Promise<{
    minNGN: number;
    maxNGN: number;
    minToken: number;
    maxToken: number;
  }> {
    const tokenPrice = await PriceService.fetchTokenPrice(fromToken);
    
    // Set reasonable limits (can be adjusted based on liquidity)
    const minNGN = 100; // ₦100 minimum
    const maxNGN = 10000000; // ₦10M maximum
    
    const minToken = minNGN / tokenPrice.ngn;
    const maxToken = maxNGN / tokenPrice.ngn;

    return {
      minNGN,
      maxNGN,
      minToken,
      maxToken,
    };
  }

  /**
   * Estimate transaction time based on network congestion
   * 
   * @param chainId - Network chain ID
   * @returns Estimated time in seconds
   */
  static estimateTransactionTime(chainId: number): number {
    // Approximate block times
    const blockTimes: { [chainId: number]: number } = {
      1: 12,      // Ethereum
      56: 3,      // BSC
      137: 2,     // Polygon
      1135: 2,    // Lisk
      11155111: 12, // Sepolia
      4202: 2,    // Lisk Sepolia
    };

    const blockTime = blockTimes[chainId] || 12;
    
    // Estimate 3 confirmations needed
    return blockTime * 3;
  }

  /**
   * Format NGN amount with proper currency display
   * 
   * @param amount - Amount in NGN
   * @returns Formatted string
   */
  static formatNGN(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format token amount with appropriate decimals
   * 
   * @param amount - Token amount
   * @param symbol - Token symbol
   * @returns Formatted string
   */
  static formatTokenAmount(amount: number, symbol: string): string {
    // Stablecoins show 2 decimals, others show 6
    const decimals = ['USDT', 'USDC', 'DAI'].includes(symbol.toUpperCase()) ? 2 : 6;
    return `${amount.toFixed(decimals)} ${symbol.toUpperCase()}`;
  }
}

export default SwapCalculator;
