import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWalletStore } from '@/store/walletStore';
import type { ThemeColors } from '@/constants/Colors';
import type { Network } from '@/constants/Tokens';

interface NetworkSelectorProps {
  visible: boolean;
  onClose: () => void;
}

interface NetworkWithBalance extends Network {
  balance: string;
  ngnValue: number;
  isLoading: boolean;
}

export default function NetworkSelector({ visible, onClose }: NetworkSelectorProps) {
  const { colors } = useTheme();
  const {
    currentNetwork,
    setCurrentNetwork,
    isTestnet,
    toggleTestnet,
    availableNetworks,
  } = useNetwork();
  const wallet = useWalletStore((state) => state.wallet);
  const { portfolio, isLoading: portfolioLoading, formatNGN } = usePortfolio({
    walletAddress: wallet?.smartAccountAddress || undefined,
    autoRefresh: false,
  });
  const styles = createStyles(colors, isTestnet);

  // Create networks with balance data
  const getNetworkWithBalance = (network: Network): NetworkWithBalance => {
    // Find holdings for this network's native token
    const nativeTokenHolding = portfolio?.holdings.find(
      h => h.network.chainId === network.chainId && h.token.isNative
    );

    return {
      ...network,
      balance: nativeTokenHolding?.balance || '0',
      ngnValue: nativeTokenHolding?.valueNGN || 0,
      isLoading: portfolioLoading,
    };
  };

  const handleSelectNetwork = (network: Network) => {
    setCurrentNetwork(network);
    onClose();
  };

  // Group networks by mainnet/testnet with balance data
  const mainnetNetworks = availableNetworks
    .filter(n => !n.isTestnet)
    .map(getNetworkWithBalance);
  const testnetNetworks = availableNetworks
    .filter(n => n.isTestnet)
    .map(getNetworkWithBalance);

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );

  const renderNetworkItem = ({ item }: { item: NetworkWithBalance }) => {
    const isSelected = item.chainId === currentNetwork.chainId;

    return (
      <TouchableOpacity
        style={[
          styles.networkItem,
          isSelected && styles.networkItemSelected,
        ]}
        onPress={() => handleSelectNetwork(item)}
        activeOpacity={0.7}
      >
        <View style={styles.networkInfo}>
          {/* Network Logo */}
          <View style={styles.networkIconContainer}>
            {item.logoUrl ? (
              <Image source={{ uri: item.logoUrl }} style={styles.networkIcon} />
            ) : (
              <MaterialCommunityIcons
                name="web"
                size={24}
                color={colors.primary}
              />
            )}
          </View>

          {/* Network Details */}
          <View style={styles.networkDetails}>
            <View style={styles.networkNameRow}>
              <Text style={styles.networkName}>{item.name}</Text>
              {item.isTestnet && (
                <View style={styles.testnetBadge}>
                  <Text style={styles.testnetBadgeText}>TEST</Text>
                </View>
              )}
            </View>
            
            {/* Balance Info - Shows token symbol with balance and NGN value */}
            {item.isLoading ? (
              <View style={styles.balanceRow}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.networkSymbol}> Loading balance...</Text>
              </View>
            ) : (
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceAmount}>
                  {parseFloat(item.balance).toFixed(4)} {item.nativeCurrency.symbol}
                </Text>
                <Text style={styles.balanceFiat}>
                  {formatNGN(item.ngnValue)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Selected Indicator */}
        {isSelected && (
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={colors.success}
          />
        )}
      </TouchableOpacity>
    );
  };

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
            <Text style={styles.headerTitle}>Select Network</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Testnet Toggle - Now for visual indicator only */}
          <View style={styles.testnetToggle}>
            <View style={styles.testnetToggleLeft}>
              <MaterialCommunityIcons
                name={isTestnet ? 'flask' : 'check-decagram'}
                size={20}
                color={isTestnet ? colors.warning : colors.success}
              />
              <Text style={styles.testnetToggleText}>
                {isTestnet ? 'Testnet Mode' : 'Mainnet Mode'}
              </Text>
            </View>
            <Switch
              value={isTestnet}
              onValueChange={toggleTestnet}
              trackColor={{ false: colors.border, true: colors.warning }}
              thumbColor={isTestnet ? colors.warning : colors.success}
            />
          </View>

          {/* Network List with Sections */}
          <ScrollView
            style={styles.networkScrollView}
            contentContainerStyle={styles.networkList}
            showsVerticalScrollIndicator={false}
          >
            {/* Mainnets Section */}
            {mainnetNetworks.length > 0 && (
              <>
                {renderSectionHeader('Mainnets', mainnetNetworks.length)}
                {mainnetNetworks.map(network => (
                  <View key={network.chainId}>
                    {renderNetworkItem({ item: network })}
                  </View>
                ))}
              </>
            )}

            {/* Testnets Section */}
            {testnetNetworks.length > 0 && (
              <>
                {renderSectionHeader('Testnets', testnetNetworks.length)}
                {testnetNetworks.map(network => (
                  <View key={network.chainId}>
                    {renderNetworkItem({ item: network })}
                  </View>
                ))}
              </>
            )}

            {/* Empty State */}
            {availableNetworks.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="web-off"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>
                  No networks available
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Add Custom Network Button */}
          <TouchableOpacity style={styles.addNetworkButton}>
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.addNetworkText}>Add Custom Network</Text>
          </TouchableOpacity>
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
    closeButton: {
      padding: 8,
    },
    testnetToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: isTestnet ? colors.warning + '10' : colors.success + '10',
      marginHorizontal: 20,
      marginTop: 16,
      borderRadius: 12,
    },
    testnetToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    testnetToggleText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    networkList: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    networkScrollView: {
      maxHeight: 450,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    sectionCount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    networkItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    networkItemSelected: {
      borderColor: colors.success,
      backgroundColor: colors.success + '10',
    },
    networkInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    networkIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    networkIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    networkDetails: {
      flex: 1,
    },
    networkNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    networkName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    testnetBadge: {
      backgroundColor: colors.warning + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    testnetBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.warning,
    },
    networkSymbol: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    balanceInfo: {
      marginTop: 4,
    },
    balanceAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    balanceFiat: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '500',
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
    addNetworkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addNetworkText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  });
