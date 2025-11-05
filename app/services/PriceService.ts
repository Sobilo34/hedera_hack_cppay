import axios from 'axios';
import { PriceData } from '@/types/wallet';

/**
 * PriceService - Handles cryptocurrency price fetching and conversion (MOCKED)
 * MOCKED VERSION FOR TESTING - Real implementation commented out below
 */
class PriceService {
  private static readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private static readonly CACHE_DURATION = 60000; // 1 minute
  private static priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map();

  // Symbol to CoinGecko ID mapping
  private static readonly SYMBOL_TO_ID: { [key: string]: string } = {
    'ETH': 'ethereum',
    'BTC': 'bitcoin',
    'BNB': 'binancecoin',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'ARB': 'arbitrum',
    'OP': 'optimism',
  };

  /**
   * Convert symbol to CoinGecko ID
   */
  private static symbolToId(symbol: string): string {
    return this.SYMBOL_TO_ID[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Get token price in specified currency (compatible with old interface)
   */
  static async getTokenPrice(symbol: string, currency: string = 'usd'): Promise<{ price: string }> {
    console.log(`💰 MOCK: Getting ${symbol} price in ${currency}`);
    
    const priceData = await this.fetchTokenPrice(symbol);
    
    let priceValue: number;
    if (currency.toLowerCase() === 'ngn') {
      priceValue = priceData.ngn;
    } else {
      priceValue = priceData.usd;
    }
    
    return {
      price: priceValue.toString()
    };
  }

  /**
   * Fetch token price in USD and NGN (MOCKED)
   */
  static async fetchTokenPrice(symbol: string): Promise<PriceData> {
    console.log(`💰 MOCK: Fetching price for ${symbol}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock prices with realistic data
    const mockPrices: { [key: string]: PriceData } = {
      'ETH': {
        usd: 3045.67,
        ngn: 4890720, // ~₦4.89M per ETH at current rates
        change24h: 2.45,
        lastUpdated: Date.now(),
      },
      'USDC': {
        usd: 1.00,
        ngn: 1606, // ~₦1,606 per USDC
        change24h: 0.02,
        lastUpdated: Date.now(),
      },
      'USDT': {
        usd: 0.9999,
        ngn: 1605.4,
        change24h: -0.01,
        lastUpdated: Date.now(),
      },
      'WETH': {
        usd: 3045.67,
        ngn: 4890720,
        change24h: 2.45,
        lastUpdated: Date.now(),
      },
      'BTC': {
        usd: 97850.23,
        ngn: 157153469,
        change24h: 1.87,
        lastUpdated: Date.now(),
      },
    };
    
    const symbolUpper = symbol.toUpperCase();
    const priceData = mockPrices[symbolUpper] || {
      usd: 1.0,
      ngn: 1606,
      change24h: 0,
      lastUpdated: Date.now(),
    };

    // Cache the result
    this.priceCache.set(symbolUpper, { data: priceData, timestamp: Date.now() });
    
    console.log(`💰 MOCK: ${symbol} = $${priceData.usd} / ₦${priceData.ngn.toLocaleString()}`);
    return priceData;
  }

  /**
   * Fetch multiple token prices at once (MOCKED)
   */
  static async fetchMultiplePrices(
    symbols: string[]
  ): Promise<{ [symbol: string]: PriceData }> {
    console.log(`💰 MOCK: Fetching multiple prices for ${symbols.join(', ')}`);
    
    const prices: { [symbol: string]: PriceData } = {};
    
    // Get prices for each symbol using our mock function
    for (const symbol of symbols) {
      prices[symbol] = await this.fetchTokenPrice(symbol);
    }

    return prices;
  }

  /**
   * Fetch NGN/USD exchange rate (MOCKED)
   */
  static async fetchNGNRate(): Promise<number> {
    console.log('💰 MOCK: Getting NGN/USD exchange rate');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Return realistic mock rate
    return 1606; // Current approximate rate
  }

  /**
   * Convert USD to NGN
   */
  static async convertUSDToNGN(usdAmount: number): Promise<number> {
    const rate = await this.fetchNGNRate();
    return usdAmount * rate;
  }

  /**
   * Convert NGN to USD
   */
  static async convertNGNToUSD(ngnAmount: number): Promise<number> {
    const rate = await this.fetchNGNRate();
    return ngnAmount / rate;
  }

  /**
   * Calculate crypto amount needed for NGN target
   */
  static async calculateCryptoNeeded(
    ngnAmount: number,
    cryptoSymbol: string,
    includeBuffer: boolean = true
  ): Promise<number> {
    try {
      const priceData = await this.fetchTokenPrice(cryptoSymbol);
      
      if (priceData.ngn === 0) {
        throw new Error('Price not available');
      }

      // Calculate base amount
      let cryptoAmount = ngnAmount / priceData.ngn;

      // Add 2% buffer for price slippage and fees if requested
      if (includeBuffer) {
        cryptoAmount *= 1.02;
      }

      return cryptoAmount;
    } catch (error) {
      console.error('Failed to calculate crypto needed:', error);
      throw error;
    }
  }

  /**
   * Calculate NGN equivalent of crypto amount
   */
  static async calculateNGNEquivalent(
    cryptoAmount: number,
    cryptoSymbol: string
  ): Promise<number> {
    try {
      const priceData = await this.fetchTokenPrice(cryptoSymbol);
      return cryptoAmount * priceData.ngn;
    } catch (error) {
      console.error('Failed to calculate NGN equivalent:', error);
      return 0;
    }
  }

  /**
   * Start real-time price updates
   */
  static startPriceUpdates(
    symbols: string[],
    callback: (prices: { [symbol: string]: PriceData }) => void
  ): () => void {
    const updatePrices = async () => {
      const prices = await this.fetchMultiplePrices(symbols);
      callback(prices);
    };

    // Initial fetch
    updatePrices();

    // Set up interval
    const interval = setInterval(updatePrices, this.CACHE_DURATION);

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Clear price cache
   */
  static clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get cached price if available
   */
  static getCachedPrice(symbol: string): PriceData | null {
    const cached = this.priceCache.get(symbol.toUpperCase());
    return cached ? cached.data : null;
  }
}

export default PriceService;
