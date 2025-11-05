/**
 * Portfolio Service
 * Calculates total portfolio value in NGN by:
 * 1. Getting token balances across all networks
 * 2. Fetching USD price for each token
 * 3. Converting USD to NGN
 * 4. Summing all values
 */

import { createPublicClient, http, formatUnits } from 'viem';
import type { Address } from 'viem';
import { 
  DEFAULT_NETWORKS, 
  DEFAULT_TOKENS, 
  getTokensForNetwork,
  type Token,
  type Network 
} from '@/constants/Tokens';

// ERC-20 ABI for balance checking
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export interface TokenHolding {
  token: Token;
  network: Network;
  balance: string; // Formatted balance (e.g., "1.5")
  balanceRaw: bigint; // Raw balance in smallest unit
  priceUSD: number; // Price per token in USD
  priceNGN: number; // Price per token in NGN
  valueUSD: number; // Total value in USD
  valueNGN: number; // Total value in NGN
}

export interface PortfolioSummary {
  totalValueUSD: number;
  totalValueNGN: number;
  holdings: TokenHolding[];
  lastUpdated: number;
  usdToNgnRate: number;
}

/**
 * Portfolio Service Class
 */
class PortfolioService {
  private static readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private static readonly EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
  private static readonly CACHE_DURATION = 120000; // 2 minutes
  
  // Price cache
  private static priceCache: Map<string, { usd: number; ngn: number; timestamp: number }> = new Map();
  private static usdToNgnRate: number = 1650; // Fallback NGN rate

  // Symbol to CoinGecko ID mapping
  private static readonly SYMBOL_TO_ID: { [key: string]: string } = {
    'ETH': 'ethereum',
    'LSK': 'lisk',
    'USDC': 'usd-coin',
    'USDT': 'tether',
  };

  /**
   * Get USD to NGN exchange rate
   */
  private static async getUSDtoNGNRate(): Promise<number> {
    try {
      const response = await fetch(this.EXCHANGE_RATE_API);
      const data = await response.json();
      
      if (data.rates && data.rates.NGN) {
        this.usdToNgnRate = data.rates.NGN;
        return data.rates.NGN;
      }
      
      return this.usdToNgnRate;
    } catch (error) {
      console.warn('Failed to fetch USD/NGN rate, using fallback:', error);
      return this.usdToNgnRate;
    }
  }

  /**
   * Convert symbol to CoinGecko ID
   */
  private static symbolToId(symbol: string): string {
    return this.SYMBOL_TO_ID[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Fetch token price in USD and NGN
   */
  private static async fetchTokenPrice(symbol: string): Promise<{ usd: number; ngn: number }> {
    const cacheKey = symbol.toUpperCase();
    const cached = this.priceCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { usd: cached.usd, ngn: cached.ngn };
    }

    try {
      const id = this.symbolToId(symbol);
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`
      );
      const data = await response.json();

      if (!data[id] || !data[id].usd) {
        throw new Error(`Price data not found for ${symbol}`);
      }

      const usdPrice = data[id].usd;
      const ngnRate = await this.getUSDtoNGNRate();
      const ngnPrice = usdPrice * ngnRate;

      // Cache the result
      this.priceCache.set(cacheKey, { 
        usd: usdPrice, 
        ngn: ngnPrice, 
        timestamp: Date.now() 
      });

      return { usd: usdPrice, ngn: ngnPrice };
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      
      // Return cached data if available, even if expired
      if (cached) {
        return { usd: cached.usd, ngn: cached.ngn };
      }

      // Return zero prices as fallback
      return { usd: 0, ngn: 0 };
    }
  }

  /**
   * Fetch multiple token prices at once (optimized)
   */
  private static async fetchMultiplePrices(
    symbols: string[]
  ): Promise<Map<string, { usd: number; ngn: number }>> {
    const pricesMap = new Map<string, { usd: number; ngn: number }>();
    
    // Get unique symbols
    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    
    // Check cache first
    const uncachedSymbols: string[] = [];
    for (const symbol of uniqueSymbols) {
      const cached = this.priceCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        pricesMap.set(symbol, { usd: cached.usd, ngn: cached.ngn });
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Fetch uncached prices in batch
    if (uncachedSymbols.length > 0) {
      try {
        const ids = uncachedSymbols.map(s => this.symbolToId(s)).join(',');
        const response = await fetch(
          `${this.COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd`
        );
        const data = await response.json();
        const ngnRate = await this.getUSDtoNGNRate();

        for (const symbol of uncachedSymbols) {
          const id = this.symbolToId(symbol);
          if (data[id] && data[id].usd) {
            const usdPrice = data[id].usd;
            const ngnPrice = usdPrice * ngnRate;
            
            pricesMap.set(symbol, { usd: usdPrice, ngn: ngnPrice });
            this.priceCache.set(symbol, { 
              usd: usdPrice, 
              ngn: ngnPrice, 
              timestamp: Date.now() 
            });
          } else {
            pricesMap.set(symbol, { usd: 0, ngn: 0 });
          }
        }
      } catch (error) {
        console.error('Failed to fetch batch prices:', error);
        // Set zero prices for uncached symbols
        for (const symbol of uncachedSymbols) {
          pricesMap.set(symbol, { usd: 0, ngn: 0 });
        }
      }
    }

    return pricesMap;
  }

  /**
   * Check if a contract exists at the given address
   * This prevents "returned no data" errors for non-existent contracts
   */
  private static async contractExists(
    publicClient: any,
    address: string
  ): Promise<boolean> {
    try {
      const code = await publicClient.getBytecode({
        address: address as Address,
      });
      // Contract exists if bytecode is not empty
      return code !== undefined && code !== '0x' && code.length > 2;
    } catch (error) {
      // If we can't check, assume it doesn't exist to be safe
      return false;
    }
  }

  /**
   * Fetch token balance for a specific wallet on a specific network
   */
  private static async fetchTokenBalance(
    walletAddress: string,
    token: Token,
    network: Network
  ): Promise<bigint> {
    try {
      // Configure RPC URL with fallbacks for unreliable networks
      const rpcUrls = this.getRpcUrlsForNetwork(network);
      
      const publicClient = createPublicClient({
        chain: {
          id: network.chainId,
          name: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: {
            default: { http: rpcUrls },
            public: { http: rpcUrls },
          },
          blockExplorers: {
            default: { name: 'Explorer', url: network.blockExplorer },
          },
        },
        transport: http(rpcUrls[0], {
          timeout: 10_000, // 10 second timeout
          retryCount: 2, // Retry twice on failure
          retryDelay: 500, // 500ms base delay between retries
        }),
      });

      const tokenAddress = token.addresses[network.chainId];

      // Handle native tokens (ETH, LSK)
      if (token.isNative || tokenAddress === '0x0000000000000000000000000000000000000000') {
        const balance = await publicClient.getBalance({
          address: walletAddress as Address,
        });
        return balance;
      }

      // Handle ERC-20 tokens (USDC, USDT)
      if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
        // ✅ Check if contract exists before querying balance
        const exists = await this.contractExists(publicClient, tokenAddress);
        if (!exists) {
          console.log(`⚠️  Skipping ${token.symbol} on ${network.name}: contract not deployed`);
          return 0n;
        }

        // Contract exists, safe to query balance
        const balance = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as Address],
        });
        return balance;
      }

      return 0n;
    } catch (error: any) {
      // Determine if this is an expected error
      const errorMessage = error?.message || String(error);
      const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('timeout');
      const isContractNotFound = errorMessage.includes('returned no data') || errorMessage.includes('contract');
      const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('network');
      
      // Expected errors that should be silently handled:
      // 1. Timeout on public RPCs (common for Sepolia)
      // 2. Contract doesn't exist (testnet tokens)
      // 3. Network connectivity issues
      const isExpectedError = isTimeout || isContractNotFound || isNetworkError;
      
      // Only log unexpected errors
      if (!isExpectedError) {
        console.error(`❌ Unexpected error fetching ${token.symbol} on ${network.name}:`, errorMessage);
      }
      
      // Return 0 balance for all error cases
      return 0n;
    }
  }

  /**
   * Get RPC URLs for a network with fallbacks
   */
  private static getRpcUrlsForNetwork(network: Network): string[] {
    const fallbackUrls: Record<number, string[]> = {
      // Ethereum Mainnet - use multiple providers
      1: [
        'https://eth.llamarpc.com',
        'https://rpc.ankr.com/eth',
        'https://ethereum.publicnode.com',
      ],
      // Sepolia Testnet - public RPC is slow, use faster alternatives
      11155111: [
        'https://rpc.sepolia.org',
        'https://ethereum-sepolia.publicnode.com',
        'https://rpc.ankr.com/eth_sepolia',
      ],
      // Lisk Mainnet
      1135: [
        'https://rpc.api.lisk.com',
      ],
      // Lisk Sepolia Testnet
      4202: [
        'https://rpc.sepolia-api.lisk.com',
      ],
    };

    return fallbackUrls[network.chainId] || [network.rpcUrl];
  }

  /**
   * Calculate complete portfolio value across all networks
   */
  static async calculatePortfolio(walletAddress: string): Promise<PortfolioSummary> {
    console.log('📊 Calculating portfolio for:', walletAddress);
    
    const holdings: TokenHolding[] = [];
    const allTokenSymbols = DEFAULT_TOKENS.map(t => t.symbol);

    // Fetch all prices in one batch for efficiency
    console.log('💰 Fetching token prices...');
    const pricesMap = await this.fetchMultiplePrices(allTokenSymbols);
    const ngnRate = await this.getUSDtoNGNRate();
    
    console.log(`💱 USD to NGN rate: ${ngnRate.toFixed(2)}`);

    // Iterate through all networks
    for (const network of DEFAULT_NETWORKS) {
      console.log(`\n🌐 Checking ${network.name} (Chain ${network.chainId})...`);
      
      const tokensOnNetwork = getTokensForNetwork(network.chainId);

      // Fetch balances for all tokens on this network
      for (const token of tokensOnNetwork) {
        try {
          console.log(`  🔍 Fetching ${token.symbol} balance...`);
          
          // Get balance
          const balanceRaw = await this.fetchTokenBalance(walletAddress, token, network);
          const balance = formatUnits(balanceRaw, token.decimals);
          const balanceNum = parseFloat(balance);

          // Skip if balance is zero
          if (balanceNum === 0) {
            console.log(`  ⏭️  ${token.symbol}: 0 (skipped)`);
            continue;
          }

          // Get prices
          const prices = pricesMap.get(token.symbol.toUpperCase()) || { usd: 0, ngn: 0 };
          
          // Calculate values
          const valueUSD = balanceNum * prices.usd;
          const valueNGN = balanceNum * prices.ngn;

          console.log(`  ✅ ${token.symbol}: ${balance} (≈ $${valueUSD.toFixed(2)} / ₦${valueNGN.toFixed(2)})`);

          holdings.push({
            token,
            network,
            balance,
            balanceRaw,
            priceUSD: prices.usd,
            priceNGN: prices.ngn,
            valueUSD,
            valueNGN,
          });
        } catch (error) {
          console.error(`  ❌ Error with ${token.symbol}:`, error);
        }
      }
    }

    // Calculate totals
    const totalValueUSD = holdings.reduce((sum, h) => sum + h.valueUSD, 0);
    const totalValueNGN = holdings.reduce((sum, h) => sum + h.valueNGN, 0);

    console.log('\n📈 Portfolio Summary:');
    console.log(`  Total USD: $${totalValueUSD.toFixed(2)}`);
    console.log(`  Total NGN: ₦${totalValueNGN.toFixed(2)}`);
    console.log(`  Holdings: ${holdings.length} token(s) across ${DEFAULT_NETWORKS.length} network(s)`);

    return {
      totalValueUSD,
      totalValueNGN,
      holdings,
      lastUpdated: Date.now(),
      usdToNgnRate: ngnRate,
    };
  }

  /**
   * Get portfolio value for a specific network only
   */
  static async calculatePortfolioForNetwork(
    walletAddress: string,
    chainId: number
  ): Promise<PortfolioSummary> {
    const network = DEFAULT_NETWORKS.find(n => n.chainId === chainId);
    if (!network) {
      throw new Error(`Network with chain ID ${chainId} not found`);
    }

    const holdings: TokenHolding[] = [];
    const tokensOnNetwork = getTokensForNetwork(chainId);
    const tokenSymbols = tokensOnNetwork.map(t => t.symbol);

    // Fetch prices
    const pricesMap = await this.fetchMultiplePrices(tokenSymbols);
    const ngnRate = await this.getUSDtoNGNRate();

    // Fetch balances
    for (const token of tokensOnNetwork) {
      try {
        const balanceRaw = await this.fetchTokenBalance(walletAddress, token, network);
        const balance = formatUnits(balanceRaw, token.decimals);
        const balanceNum = parseFloat(balance);

        if (balanceNum === 0) continue;

        const prices = pricesMap.get(token.symbol.toUpperCase()) || { usd: 0, ngn: 0 };
        const valueUSD = balanceNum * prices.usd;
        const valueNGN = balanceNum * prices.ngn;

        holdings.push({
          token,
          network,
          balance,
          balanceRaw,
          priceUSD: prices.usd,
          priceNGN: prices.ngn,
          valueUSD,
          valueNGN,
        });
      } catch (error) {
        console.error(`Error fetching ${token.symbol} on ${network.name}:`, error);
      }
    }

    const totalValueUSD = holdings.reduce((sum, h) => sum + h.valueUSD, 0);
    const totalValueNGN = holdings.reduce((sum, h) => sum + h.valueNGN, 0);

    return {
      totalValueUSD,
      totalValueNGN,
      holdings,
      lastUpdated: Date.now(),
      usdToNgnRate: ngnRate,
    };
  }

  /**
   * Format NGN value with proper formatting
   */
  static formatNGN(value: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format USD value
   */
  static formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Clear price cache (useful for force refresh)
   */
  static clearCache(): void {
    this.priceCache.clear();
    console.log('💾 Price cache cleared');
  }
}

export default PortfolioService;
