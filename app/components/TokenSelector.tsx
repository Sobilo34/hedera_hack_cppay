import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/constants/Colors';
import { Token } from '@/constants/Tokens';
import TokenModal from './TokenModal';
import type { TokenBalance } from '@/services/TokenBalanceService';

interface TokenSelectorProps {
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
  currentChainId: number;
  tokenBalances: TokenBalance[];
  isTestnet: boolean;
}

export default function TokenSelector({
  selectedToken,
  onSelectToken,
  currentChainId,
  tokenBalances,
  isTestnet,
}: TokenSelectorProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.tokenInfo}>
          {/* Token Logo */}
          <View style={styles.tokenIconContainer}>
            {selectedToken.logoUrl ? (
              <Image source={{ uri: selectedToken.logoUrl }} style={styles.tokenIcon} />
            ) : (
              <MaterialCommunityIcons name="currency-usd" size={20} color={colors.primary} />
            )}
          </View>

          {/* Token Symbol */}
          <Text style={styles.tokenSymbol}>{selectedToken.symbol}</Text>
        </View>

        {/* Dropdown Icon */}
        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Token Selection Modal */}
      <TokenModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelectToken={handleSelectToken}
        currentChainId={currentChainId}
        tokenBalances={tokenBalances}
        isTestnet={isTestnet}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 120,
    },
    tokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tokenIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tokenIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    tokenSymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
