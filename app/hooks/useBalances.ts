/**
 * Balance Hook - Smart balance management with caching and background updates
 * 
 * Features:
 * - Returns cached balance immediately (0 if none)
 * - Updates in background without blocking UI
 * - Automatic refresh when data is stale
 * - Manual refresh capability
 * - No loading states - always shows data
 */

import { useEffect, useCallback } from 'react';
import { useBalanceStore } from '@/store/balanceStore';
import type { TokenBalance } from '@/services/TokenBalanceService';

export interface UseBalancesOptions {
  address?: string;
  chainId: number;
  autoRefresh?: boolean; // Auto-refresh when stale (default: true)
  refreshOnMount?: boolean; // Refresh on component mount (default: true)
}

export interface UseBalancesResult {
  balances: TokenBalance[];
  isUpdating: boolean;
  isStale: boolean;
  totalUSD: number;
  totalNGN: number;
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  lastUpdated: number | null;
}

export function useBalances(options: UseBalancesOptions): UseBalancesResult {
  const {
    address,
    chainId,
    autoRefresh = true,
    refreshOnMount = true,
  } = options;

  const {
    getBalances,
    isBalanceStale,
    isUpdating,
    updateBalances,
    getTotalPortfolioValue,
    networkBalances,
  } = useBalanceStore();

  // Get current balances (always returns data, never undefined)
  const balances = address ? getBalances(chainId, address) : [];
  const currentIsUpdating = address ? isUpdating(chainId, address) : false;
  const currentIsStale = address ? isBalanceStale(chainId, address) : false;

  // Get last updated timestamp
  const lastUpdated = address && networkBalances[chainId]?.[address]?.lastUpdated || null;

  // Calculate totals
  const totalUSD = address ? getTotalPortfolioValue(chainId, address, 'USD') : 0;
  const totalNGN = address ? getTotalPortfolioValue(chainId, address, 'NGN') : 0;

  /**
   * Manual refresh - always updates
   */
  const refresh = useCallback(async () => {
    if (!address) return;
    await updateBalances(chainId, address, false);
  }, [address, chainId, updateBalances]);

  /**
   * Force refresh - bypasses rate limiting
   */
  const forceRefresh = useCallback(async () => {
    if (!address) return;
    await updateBalances(chainId, address, true);
  }, [address, chainId, updateBalances]);

  /**
   * Auto-refresh logic
   */
  useEffect(() => {
    if (!address) return;

    let timeoutId: NodeJS.Timeout;

    const scheduleRefresh = () => {
      const shouldRefresh = isBalanceStale(chainId, address);
      const currentlyUpdating = isUpdating(chainId, address);

      if (shouldRefresh && !currentlyUpdating && autoRefresh) {
        console.log(`🔄 Auto-refreshing stale balance for ${address}`);
        updateBalances(chainId, address, false);
      }

      // Check again in 30 seconds
      timeoutId = setTimeout(scheduleRefresh, 30000);
    };

    // Initial check on mount
    if (refreshOnMount) {
      const shouldRefresh = isBalanceStale(chainId, address);
      if (shouldRefresh) {
        console.log(`🔄 Initial refresh for ${address} on mount`);
        updateBalances(chainId, address, false);
      }
    }

    // Start periodic checks
    if (autoRefresh) {
      timeoutId = setTimeout(scheduleRefresh, 5000); // First check in 5 seconds
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [address, chainId, autoRefresh, refreshOnMount, isBalanceStale, isUpdating, updateBalances]);

  return {
    balances,
    isUpdating: currentIsUpdating,
    isStale: currentIsStale,
    totalUSD,
    totalNGN,
    refresh,
    forceRefresh,
    lastUpdated,
  };
}

/**
 * Hook for single token balance
 */
export function useTokenBalance(
  address: string | undefined,
  chainId: number,
  tokenSymbol: string
): {
  balance: TokenBalance | null;
  isUpdating: boolean;
  refresh: () => Promise<void>;
} {
  const { balances, isUpdating, refresh } = useBalances({
    address,
    chainId,
    autoRefresh: true,
    refreshOnMount: true,
  });

  const balance = balances.find(b => b.token.symbol === tokenSymbol) || null;

  return {
    balance,
    isUpdating,
    refresh,
  };
}

/**
 * Hook for native token balance only
 */
export function useNativeBalance(
  address: string | undefined,
  chainId: number
): {
  balance: string;
  balanceUSD: number;
  balanceNGN: number;
  isUpdating: boolean;
  refresh: () => Promise<void>;
} {
  const { balances, isUpdating, refresh } = useBalances({
    address,
    chainId,
    autoRefresh: true,
    refreshOnMount: true,
  });

  const nativeBalance = balances.find(b => b.token.isNative);

  return {
    balance: nativeBalance?.balance || '0',
    balanceUSD: nativeBalance?.balanceUSD || 0,
    balanceNGN: nativeBalance?.balanceNGN || 0,
    isUpdating,
    refresh,
  };
}