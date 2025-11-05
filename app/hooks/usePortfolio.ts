/**
 * Portfolio Hook
 * React hook for managing portfolio calculations
 */

import { useState, useEffect, useCallback } from 'react';
import PortfolioService, { PortfolioSummary, TokenHolding } from '@/services/PortfolioService';

export interface UsePortfolioOptions {
  walletAddress?: string;
  chainId?: number; // Optional: calculate for specific network only
  autoRefresh?: boolean; // Auto-refresh every 2 minutes
  refreshInterval?: number; // Custom refresh interval in ms
}

export interface UsePortfolioResult {
  portfolio: PortfolioSummary | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  clearCache: () => void;
  formatNGN: (value: number) => string;
  formatUSD: (value: number) => string;
}

export function usePortfolio(options: UsePortfolioOptions = {}): UsePortfolioResult {
  const {
    walletAddress,
    chainId,
    autoRefresh = false,
    refreshInterval = 120000, // 2 minutes
  } = options;

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Calculate portfolio
   */
  const calculatePortfolio = useCallback(async () => {
    if (!walletAddress) {
      setError(new Error('Wallet address is required'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result: PortfolioSummary;

      if (chainId) {
        // Calculate for specific network
        result = await PortfolioService.calculatePortfolioForNetwork(walletAddress, chainId);
      } else {
        // Calculate for all networks
        result = await PortfolioService.calculatePortfolio(walletAddress);
      }

      setPortfolio(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to calculate portfolio');
      setError(errorMessage);
      console.error('Portfolio calculation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, chainId]);

  /**
   * Refresh portfolio
   */
  const refresh = useCallback(async () => {
    await calculatePortfolio();
  }, [calculatePortfolio]);

  /**
   * Clear cache and refresh
   */
  const clearCache = useCallback(() => {
    PortfolioService.clearCache();
    refresh();
  }, [refresh]);

  /**
   * Initial load - Only on mount or when wallet address changes
   */
  useEffect(() => {
    if (walletAddress) {
      calculatePortfolio();
    }
  }, [walletAddress]); // Only recalculate when address changes, not chainId

  /**
   * Auto-refresh - REMOVED
   * Balance updates should be handled by manual refresh or event emission
   * Continuous polling is disabled to save resources and API calls
   */
  // Auto-refresh removed - use manual refresh() or event-based updates

  return {
    portfolio,
    isLoading,
    error,
    refresh,
    clearCache,
    formatNGN: PortfolioService.formatNGN,
    formatUSD: PortfolioService.formatUSD,
  };
}

/**
 * Hook for getting portfolio by network groups
 */
export function usePortfolioByNetwork(walletAddress?: string) {
  const { portfolio, isLoading, error, refresh } = usePortfolio({ walletAddress });

  const portfolioByNetwork = portfolio?.holdings.reduce((acc, holding) => {
    const networkName = holding.network.name;
    if (!acc[networkName]) {
      acc[networkName] = {
        network: holding.network,
        holdings: [],
        totalUSD: 0,
        totalNGN: 0,
      };
    }
    acc[networkName].holdings.push(holding);
    acc[networkName].totalUSD += holding.valueUSD;
    acc[networkName].totalNGN += holding.valueNGN;
    return acc;
  }, {} as Record<string, {
    network: any;
    holdings: TokenHolding[];
    totalUSD: number;
    totalNGN: number;
  }>);

  return {
    portfolioByNetwork: portfolioByNetwork || {},
    totalValueUSD: portfolio?.totalValueUSD || 0,
    totalValueNGN: portfolio?.totalValueNGN || 0,
    isLoading,
    error,
    refresh,
  };
}
