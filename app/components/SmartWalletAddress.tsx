import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';

interface SmartWalletAddressProps {
  address: string | null;
  isLoading?: boolean;
  onRetry?: () => void;
}

export function SmartWalletAddress({ address, isLoading, onRetry }: SmartWalletAddressProps) {
  const { colors } = useTheme();

  const copyAddress = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      // Show toast notification
      console.log('✅ Address copied to clipboard');
    }
  };

  const formatAddress = (addr: string): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading smart wallet...</Text>
        </View>
      </View>
    );
  }

  if (!address) {
    return (
      <TouchableOpacity 
        style={styles.errorContainer}
        onPress={onRetry}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons 
          name="alert-circle-outline" 
          size={16} 
          color={colors.error} 
        />
        <Text style={styles.errorText}>
          Tap to retry loading address
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={copyAddress}
      activeOpacity={0.7}
    >
      <View style={styles.labelRow}>
        <MaterialCommunityIcons 
          name="wallet" 
          size={12} 
          color={colors.textSecondary} 
        />
        <Text style={styles.label}>Smart Wallet</Text>
      </View>
      <View style={styles.addressBox}>
        <Text style={styles.address}>
          {formatAddress(address)}
        </Text>
        <MaterialCommunityIcons 
          name="content-copy" 
          size={14} 
          color={colors.primary} 
        />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '20', // 20% opacity
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight + '40',
  },
  address: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textPrimary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
  },
});
