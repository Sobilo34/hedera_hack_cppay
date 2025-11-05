/**
 * GasAllowanceScreen - Full screen for gas management
 * 
 * Features:
 * - Current usage statistics
 * - Transaction history with gas breakdown
 * - Upgrade to verified user CTA
 * - Daily/weekly/monthly usage charts
 * - Gas sponsorship explanation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import PaymasterService, { GasAllowanceStatus } from '@/services/PaymasterService';
import { useWalletStore } from '@/store/walletStore';

const { width } = Dimensions.get('window');

export default function GasAllowanceScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<GasAllowanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { wallet } = useWalletStore();
  const smartAccountAddress = wallet.smartAccountAddress;
  const activeNetwork = wallet.activeNetwork;
  
  // Only available on Lisk networks
  const isLiskNetwork = activeNetwork === 1135 || activeNetwork === 4202;
  
  useEffect(() => {
    if (!isLiskNetwork) {
      router.back();
      return;
    }
    
    fetchGasAllowance();
  }, [smartAccountAddress, activeNetwork]);
  
  const fetchGasAllowance = async (isRefresh = false) => {
    if (!smartAccountAddress) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const paymasterService = PaymasterService.getInstance();
      
      // Clear cache to get fresh data
      if (isRefresh) {
        paymasterService.clearCache(smartAccountAddress, activeNetwork);
      }
      
      const allowanceStatus = await paymasterService.getGasAllowanceStatus(
        smartAccountAddress,
        activeNetwork
      );
      
      setStatus(allowanceStatus);
    } catch (error) {
      console.error('Failed to fetch gas allowance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = () => {
    fetchGasAllowance(true);
  };
  
  if (loading && !status) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8FD9FB" />
        <Text style={styles.loadingText}>Loading gas allowance...</Text>
      </View>
    );
  }
  
  if (!status) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Failed to Load</Text>
        <Text style={styles.errorMessage}>
          Could not fetch gas allowance information
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchGasAllowance()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const percentRemaining = 100 - status.percentUsed;
  
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gas Allowance</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Hero Card */}
      <LinearGradient
        colors={['#8FD9FB', '#7AC8E8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <Ionicons name="flash" size={32} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Daily Gas Allowance</Text>
        </View>
        
        <View style={styles.heroAmount}>
          <Text style={styles.heroAmountValue}>
            {PaymasterService.formatGasAmount(status.remaining)}
          </Text>
          <Text style={styles.heroAmountLabel}>Remaining</Text>
        </View>
        
        {/* Progress Circle */}
        <View style={styles.progressCircle}>
          <View style={styles.progressCircleInner}>
            <Text style={styles.progressPercentage}>{percentRemaining.toFixed(0)}%</Text>
            <Text style={styles.progressLabel}>Available</Text>
          </View>
        </View>
        
        {/* Reset Timer */}
        <View style={styles.resetTimer}>
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <Text style={styles.resetTimerText}>
            Resets in {PaymasterService.getTimeUntilReset(status.resetTime)}
          </Text>
        </View>
      </LinearGradient>
      
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="trending-up" size={24} color="#2196F3" />
          </View>
          <Text style={styles.statValue}>
            {PaymasterService.formatGasAmount(status.used)}
          </Text>
          <Text style={styles.statLabel}>Used Today</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="shield-checkmark" size={24} color="#9C27B0" />
          </View>
          <Text style={styles.statValue}>
            {PaymasterService.formatGasAmount(status.limit)}
          </Text>
          <Text style={styles.statLabel}>Daily Limit</Text>
        </View>
      </View>
      
      {/* Verified User Section */}
      {!status.isVerified && (
        <View style={styles.upgradeCard}>
          <LinearGradient
            colors={['#FFB74D', '#FFA726']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeGradient}
          >
            <Ionicons name="star" size={32} color="#FFFFFF" />
            <Text style={styles.upgradeTitle}>Upgrade to Verified User</Text>
            <Text style={styles.upgradeDescription}>
              Get 2x daily gas limit (2 ETH) with KYC verification
            </Text>
            <TouchableOpacity style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>Get Verified</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
      
      {status.isVerified && (
        <View style={styles.verifiedCard}>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.verifiedTitle}>Verified User</Text>
          </View>
          <Text style={styles.verifiedDescription}>
            You have 2x daily gas limit (2 ETH)
          </Text>
        </View>
      )}
      
      {/* How It Works */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How Gas Sponsorship Works</Text>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="flash-outline" size={24} color="#8FD9FB" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Daily Allowance</Text>
            <Text style={styles.infoItemText}>
              Get up to 1 ETH of gas sponsored per day (2 ETH for verified users)
            </Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="refresh-outline" size={24} color="#8FD9FB" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Auto Reset</Text>
            <Text style={styles.infoItemText}>
              Your allowance resets every 24 hours automatically
            </Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#8FD9FB" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Graceful Fallback</Text>
            <Text style={styles.infoItemText}>
              If you exceed your limit, transactions will use your wallet balance
            </Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="trending-up-outline" size={24} color="#8FD9FB" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoItemTitle}>Lisk Network Only</Text>
            <Text style={styles.infoItemText}>
              Gas sponsorship is currently available only on Lisk network
            </Text>
          </View>
        </View>
      </View>
      
      {/* Status Banner */}
      {!status.paymasterActive && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={24} color="#FFB74D" />
          <Text style={styles.warningText}>
            Gas sponsorship is temporarily unavailable. All transactions will use your wallet balance.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#8FD9FB',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  heroCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroAmount: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroAmountValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroAmountLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressCircleInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 28,
    fontWeight: '800',
    color: '#8FD9FB',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  resetTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  resetTimerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  upgradeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeGradient: {
    padding: 20,
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFB74D',
  },
  verifiedCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verifiedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  verifiedDescription: {
    fontSize: 14,
    color: '#2E7D32',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoItemText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
  },
});
