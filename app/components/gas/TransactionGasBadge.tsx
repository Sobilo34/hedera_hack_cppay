/**
 * TransactionGasBadge - Badge showing if transaction is gas-sponsored or user-paid
 * 
 * Displays:
 * - Green "Gas Sponsored ✓" when paymaster covers cost
 * - Yellow "User Paid" when limit exceeded or paymaster unavailable
 * - Actual gas cost in both cases
 * - Animated appearance
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PaymasterService from '@/services/PaymasterService';

interface TransactionGasBadgeProps {
  isSponsored: boolean;
  gasCost: bigint; // Gas cost in wei
  compact?: boolean;
}

export default function TransactionGasBadge({
  isSponsored,
  gasCost,
  compact = false,
}: TransactionGasBadgeProps) {
  const formattedGas = PaymasterService.formatGasAmount(gasCost);
  
  if (compact) {
    return (
      <View style={[
        styles.badge,
        styles.badgeCompact,
        isSponsored ? styles.badgeSponsored : styles.badgeUserPaid,
      ]}>
        <Ionicons
          name={isSponsored ? 'checkmark-circle' : 'card-outline'}
          size={14}
          color={isSponsored ? '#4CAF50' : '#FFB74D'}
        />
        <Text style={[
          styles.textCompact,
          isSponsored ? styles.textSponsored : styles.textUserPaid,
        ]}>
          {isSponsored ? 'Sponsored' : 'User Paid'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={[
      styles.badge,
      isSponsored ? styles.badgeSponsored : styles.badgeUserPaid,
    ]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={isSponsored ? 'flash' : 'wallet-outline'}
          size={20}
          color={isSponsored ? '#4CAF50' : '#FFB74D'}
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={[
            styles.label,
            isSponsored ? styles.textSponsored : styles.textUserPaid,
          ]}>
            {isSponsored ? 'Gas Sponsored' : 'User Paid'}
          </Text>
          {isSponsored && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color="#4CAF50"
            />
          )}
        </View>
        
        <Text style={styles.gasAmount}>{formattedGas}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
  },
  badgeCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    borderRadius: 8,
  },
  badgeSponsored: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  badgeUserPaid: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB74D',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSponsored: {
    color: '#2E7D32',
  },
  textUserPaid: {
    color: '#F57C00',
  },
  textCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
  gasAmount: {
    fontSize: 12,
    color: '#666',
  },
});
