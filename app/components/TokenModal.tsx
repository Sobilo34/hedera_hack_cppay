import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/constants/Colors';
import { Token } from '@/constants/Tokens';
import { getTokensForNetwork } from '@/constants/Tokens';
import type { TokenBalance } from '@/services/TokenBalanceService';

interface TokenModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectToken: (token: Token) => void;
  currentChainId: number;
  tokenBalances: TokenBalance[];
  isTestnet: boolean;
}

export default function TokenModal({
  visible,
  onClose,
  onSelectToken,
  currentChainId,
  tokenBalances,
  isTestnet,
}: TokenModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors, isTestnet);

  // Get tokens available for current network
  const availableTokens = useMemo(() => {
    return getTokensForNetwork(currentChainId);
  }, [currentChainId]);

  // Merge token data with balances
  const tokensWithBalances = useMemo(() => {
    return availableTokens.map((token) => {
      const balance = tokenBalances.find((b) => b.token.symbol === token.symbol);
      return {
        ...token,
        balance: balance?.balance || '0',
        balanceUSD: balance?.balanceUSD || 0,
        balanceNGN: balance?.balanceNGN || 0,
      };
    });
  }, [availableTokens, tokenBalances]);

  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    onClose();
  };

  const renderTokenItem = ({ item }: { item: Token & { balance: string; balanceUSD: number; balanceNGN: number } }) => (
    <TouchableOpacity
      style={styles.tokenItem}
      onPress={() => handleSelectToken(item)}
      activeOpacity={0.7}
    >
      <View style={styles.tokenInfo}>
        {/* Token Logo */}
        <View style={styles.tokenIconContainer}>
          {item.logoUrl ? (
            <Image source={{ uri: item.logoUrl }} style={styles.tokenIcon} />
          ) : (
            <MaterialCommunityIcons name="currency-usd" size={24} color={colors.primary} />
          )}
        </View>

        {/* Token Details */}
        <View style={styles.tokenDetails}>
          <Text style={styles.tokenSymbol}>{item.symbol}</Text>
          <Text style={styles.tokenName}>{item.name}</Text>
        </View>
      </View>

      {/* Token Balance */}
      <View style={styles.tokenBalance}>
        <Text style={styles.balanceAmount}>
          {parseFloat(item.balance).toFixed(4)}
        </Text>
        <Text style={styles.balanceValue}>
          ₦{item.balanceNGN.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>Select Token</Text>
              <View style={styles.networkBadge}>
                <MaterialCommunityIcons
                  name={isTestnet ? 'flask-outline' : 'check-circle'}
                  size={12}
                  color={isTestnet ? colors.warning : colors.success}
                />
                <Text style={styles.networkBadgeText}>
                  {isTestnet ? 'Testnet' : 'Mainnet'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Token List */}
          <FlatList
            data={tokensWithBalances}
            renderItem={renderTokenItem}
            keyExtractor={(item) => `${item.symbol}-${currentChainId}`}
            contentContainerStyle={styles.tokenList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="wallet-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  No tokens available on this network
                </Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isTestnet: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    networkBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isTestnet ? colors.warning + '20' : colors.success + '20',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    networkBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: isTestnet ? colors.warning : colors.success,
    },
    closeButton: {
      padding: 8,
    },
    tokenList: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    tokenItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    tokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    tokenIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    tokenIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    tokenDetails: {
      flex: 1,
    },
    tokenSymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    tokenName: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    tokenBalance: {
      alignItems: 'flex-end',
    },
    balanceAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    balanceValue: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyState: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
  });
