import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

interface DualWalletAddressProps {
  eoaAddress: string | null;
  smartAccountAddress: string | null;
  compact?: boolean;
}

export function DualWalletAddress({ 
  eoaAddress, 
  smartAccountAddress, 
  compact = false 
}: DualWalletAddressProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'eoa' | 'smart'>('smart');

  const copyAddress = async (address: string | null, type: string) => {
    if (address) {
      await Clipboard.setStringAsync(address);
      console.log(`✅ ${type} address copied to clipboard`);
      // TODO: Show toast notification
    }
  };

  const formatAddress = (addr: string | null): string => {
    if (!addr) return 'Not available';
    return compact ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const styles = createStyles(colors, compact);

  return (
    <View style={styles.container}>
      {/* Address Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'smart' && styles.activeTab]}
          onPress={() => setActiveTab('smart')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'smart' && styles.activeTabText
          ]}>
            Smart
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'eoa' && styles.activeTab]}
          onPress={() => setActiveTab('eoa')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'eoa' && styles.activeTabText
          ]}>
            EOA 
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Address Display */}
      <View style={styles.addressContainer}>
        <TouchableOpacity
          style={styles.addressRow}
          onPress={() => copyAddress(
            activeTab === 'smart' ? smartAccountAddress : eoaAddress,
            activeTab === 'smart' ? 'Smart Account' : 'EOA'
          )}
        >
          <Text style={styles.addressText}>
            {formatAddress(activeTab === 'smart' ? smartAccountAddress : eoaAddress)}
          </Text>
          <MaterialCommunityIcons 
            name="content-copy" 
            size={compact ? 16 : 18} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
        
        {/* Address Type Info */}
        {/* <Text style={styles.addressTypeText}>
          {activeTab === 'smart' 
            ? 'For transactions & gas sponsorship' 
            : 'For receiving funds directly'
          }
        </Text> */}
      </View>
    </View>
  );
}

const createStyles = (colors: any, compact: boolean) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: compact ? 8 : 12,
    padding: compact ? 12 : 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: compact ? 6 : 8,
    padding: 4,
    marginBottom: compact ? 8 : 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: compact ? 6 : 8,
    paddingHorizontal: compact ? 8 : 12,
    borderRadius: compact ? 4 : 6,
    gap: compact ? 4 : 6,
  },
  activeTab: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: compact ? 11 : 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  addressContainer: {
    gap: compact ? 4 : 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: compact ? 6 : 8,
    paddingHorizontal: compact ? 8 : 12,
    backgroundColor: colors.background,
    borderRadius: compact ? 6 : 8,
  },
  addressText: {
    fontSize: compact ? 13 : 14,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  addressTypeText: {
    fontSize: compact ? 10 : 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});