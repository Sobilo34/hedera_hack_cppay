/**
 * GasAllowanceCard - Display daily gas allowance status
 * 
 * Shows:
 * - Remaining gas allowance with progress bar
 * - Daily limit (1 ETH or 2 ETH for verified users)
 * - Reset countdown timer
 * - Verified user badge
 * - Animated updates on gas usage
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PaymasterService, { GasAllowanceStatus } from '@/services/PaymasterService';
import { useWalletStore } from '@/store/walletStore';

interface GasAllowanceCardProps {
  onPress?: () => void;
  compact?: boolean; // Compact view for embedding in other screens
}

export default function GasAllowanceCard({ onPress, compact = false }: GasAllowanceCardProps) {
  const [status, setStatus] = useState<GasAllowanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress] = useState(new Animated.Value(0));
  
  const { wallet } = useWalletStore();
  const smartAccountAddress = wallet.smartAccountAddress;
  const activeNetwork = wallet.activeNetwork;
  
  // Only show on Lisk networks
  const isLiskNetwork = activeNetwork === 1135 || activeNetwork === 4202;
  
  useEffect(() => {
    if (!smartAccountAddress || !isLiskNetwork) {
      setLoading(false);
      return;
    }
    
    fetchGasAllowance();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchGasAllowance, 30000);
    return () => clearInterval(interval);
  }, [smartAccountAddress, activeNetwork]);
  
  useEffect(() => {
    if (status) {
      // Animate progress bar
      const percentRemaining = 100 - status.percentUsed;
      Animated.timing(progress, {
        toValue: percentRemaining,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [status]);
  
  const fetchGasAllowance = async () => {
    if (!smartAccountAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const paymasterService = PaymasterService.getInstance();
      const allowanceStatus = await paymasterService.getGasAllowanceStatus(
        smartAccountAddress,
        activeNetwork
      );
      
      setStatus(allowanceStatus);
    } catch (err: any) {
      console.error('Failed to fetch gas allowance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Don't show card if not on Lisk network
  if (!isLiskNetwork) {
    return null;
  }
  
  if (loading && !status) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <ActivityIndicator size="small" color="#8FD9FB" />
        <Text style={styles.loadingText}>Loading gas allowance...</Text>
      </View>
    );
  }
  
  if (error || !status) {
    return (
      <View style={[styles.card, styles.errorCard, compact && styles.cardCompact]}>
        <Ionicons name="warning-outline" size={24} color="#FF6B6B" />
        <Text style={styles.errorText}>
          {error || 'Failed to load gas allowance'}
        </Text>
      </View>
    );
  }
  
  const progressInterpolate = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  
  const progressColor = 
    status.percentUsed >= 90 ? '#FF6B6B' : // Red when almost depleted
    status.percentUsed >= 50 ? '#FFB74D' : // Orange when half used
    '#4CAF50'; // Green when plenty remaining
  
  const getStatusColor = () => {
    if (!status.paymasterActive) return '#FF6B6B';
    if (status.remaining === 0n) return '#FF6B6B';
    if (status.percentUsed >= 90) return '#FFB74D';
    return '#4CAF50';
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <LinearGradient
        colors={['#8FD9FB', '#7AC8E8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.cardCompact]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="flash" size={24} color="#FFFFFF" />
            <Text style={styles.title}>Gas Sponsorship</Text>
          </View>
          
          {status.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        
        {/* Status Message */}
        <Text style={styles.statusMessage}>
          {PaymasterService.getStatusMessage(status)}
        </Text>
        
        {!compact && (
          <>
            {/* Gas Amounts */}
            <View style={styles.amounts}>
              <View style={styles.amountItem}>
                <Text style={styles.amountLabel}>Remaining</Text>
                <Text style={styles.amountValue}>
                  {PaymasterService.formatGasAmount(status.remaining)}
                </Text>
              </View>
              
              <View style={styles.amountDivider} />
              
              <View style={styles.amountItem}>
                <Text style={styles.amountLabel}>Daily Limit</Text>
                <Text style={styles.amountValue}>
                  {PaymasterService.formatGasAmount(status.limit)}
                </Text>
              </View>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressInterpolate,
                      backgroundColor: progressColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {(100 - status.percentUsed).toFixed(0)}% remaining
              </Text>
            </View>
            
            {/* Reset Timer */}
            <View style={styles.resetContainer}>
              <Ionicons name="time-outline" size={16} color="#FFFFFF" />
              <Text style={styles.resetText}>
                Resets in {PaymasterService.getTimeUntilReset(status.resetTime)}
              </Text>
            </View>
            
            {/* Info Footer */}
            {!status.paymasterActive && (
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle-outline" size={16} color="#FFB74D" />
                <Text style={styles.warningText}>
                  Gas sponsorship temporarily unavailable
                </Text>
              </View>
            )}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardCompact: {
    padding: 16,
    marginVertical: 4,
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
    opacity: 0.95,
  },
  amounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'right',
    opacity: 0.9,
  },
  resetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  resetText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 183, 77, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#FFFFFF',
    flex: 1,
  },
  loadingText: {
    marginLeft: 12,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flex: 1,
  },
});
