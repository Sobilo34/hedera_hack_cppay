import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { TokenBalance } from '@/services/TokenBalanceService';
import { formatBalance, formatCurrency } from '@/services/TokenBalanceService';

interface TokenListProps {
  balances: TokenBalance[];
  isLoading: boolean;
  onTokenPress?: (balance: TokenBalance) => void;
  onRefresh?: () => void;
  showAllTokens?: boolean;
}

export function TokenList({
  balances,
  isLoading,
  onTokenPress,
  onRefresh,
  showAllTokens = false,
}: TokenListProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Show top 3 tokens by default, or all if showAllTokens is true
  const displayedBalances = showAllTokens ? balances : balances.slice(0, 3);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tokens...</Text>
      </View>
    );
  }

  if (balances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons 
          name="wallet-outline" 
          size={48} 
          color={colors.textSecondary} 
        />
        <Text style={styles.emptyTitle}>No tokens found</Text>
        <Text style={styles.emptySubtitle}>
          Your tokens will appear here once you receive them
        </Text>
        {onRefresh && (
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {displayedBalances.map((balance, index) => (
        <TouchableOpacity
          key={`${balance.token.symbol}-${index}`}
          style={styles.tokenCard}
          onPress={() => onTokenPress?.(balance)}
          activeOpacity={0.7}
        >
          <View style={styles.tokenLeft}>
            <View style={styles.tokenIcon}>
              {balance.token.logoUrl ? (
                <Image 
                  source={{ uri: balance.token.logoUrl }} 
                  style={styles.tokenLogo}
                />
              ) : (
                <MaterialCommunityIcons 
                  name="circle" 
                  size={32} 
                  color={colors.primary} 
                />
              )}
            </View>
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenSymbol}>{balance.token.symbol}</Text>
              <Text style={styles.tokenName}>{balance.token.name}</Text>
            </View>
          </View>
          
          <View style={styles.tokenRight}>
            <Text style={styles.tokenBalance}>
              {formatBalance(balance.balance)} {balance.token.symbol}
            </Text>
            <Text style={styles.tokenValue}>
              ≈ {formatCurrency(balance.balanceNGN, 'NGN')} • {formatCurrency(balance.balanceUSD, 'USD')}
            </Text>
          </View>

          <MaterialCommunityIcons 
            name="chevron-right" 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    gap: 12,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenInfo: {
    gap: 2,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tokenName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tokenRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tokenBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tokenValue: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
