import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface SmartAccountBannerProps {
  smartAccount: {
    address: string | null;
    isDeployed: boolean;
    isInitializing: boolean;
    error: string | null;
  };
  onRetry?: () => void;
}

export function SmartAccountBanner({ smartAccount, onRetry }: SmartAccountBannerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (smartAccount.isInitializing) {
    return (
      <View style={[styles.banner, styles.bannerInfo]}>
        <MaterialCommunityIcons name="loading" size={20} color="#0066CC" />
        <Text style={styles.bannerText}>
          Initializing Smart Account...
        </Text>
      </View>
    );
  }

  if (smartAccount.error) {
    return (
      <View style={[styles.banner, styles.bannerError]}>
        <MaterialCommunityIcons name="alert-circle" size={20} color="#CC0000" />
        <View style={styles.bannerContent}>
          <Text style={styles.bannerText}>
            Failed to initialize Smart Account
          </Text>
          {onRetry && (
            <TouchableOpacity onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (smartAccount.address && !smartAccount.isDeployed) {
    return (
      <View style={[styles.banner, styles.bannerWarning]}>
        <MaterialCommunityIcons name="information" size={20} color="#FF9500" />
        <Text style={styles.bannerText}>
          Smart Account created. Will be deployed on first transaction.
        </Text>
      </View>
    );
  }

  if (smartAccount.address && smartAccount.isDeployed) {
    return (
      <View style={[styles.banner, styles.bannerSuccess]}>
        <MaterialCommunityIcons name="check-circle" size={20} color="#00CC00" />
        <Text style={styles.bannerText}>
          Smart Account active and ready!
        </Text>
      </View>
    );
  }

  return null;
}

const createStyles = (colors: any) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  bannerInfo: {
    backgroundColor: '#E6F2FF',
  },
  bannerError: {
    backgroundColor: '#FFE6E6',
  },
  bannerWarning: {
    backgroundColor: '#FFF5E6',
  },
  bannerSuccess: {
    backgroundColor: '#E6FFE6',
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  retryText: {
    fontSize: 14,
    color: '#0066CC',
    fontWeight: '600',
  },
});
