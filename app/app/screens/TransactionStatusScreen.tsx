/**
 * Transaction Status Tracking Screen
 * 
 * Real-time monitoring of transaction progress:
 * - Live status updates
 * - Progress indicators
 * - Blockchain confirmations
 * - Bank settlement tracking
 * - Error handling and retry
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native';
import CryptoToNairaService, { TransactionStage, TransactionProgress } from '../../services/CryptoToNairaService';
import BackendApiService from '../../services/BackendApiService';

interface TransactionStatusProps {
  transactionId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

const TransactionStatusScreen: React.FC<TransactionStatusProps> = ({
  transactionId,
  onComplete,
  onError,
}) => {
  const [progress, setProgress] = useState<TransactionProgress[]>([]);
  const [currentStage, setCurrentStage] = useState<TransactionStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Stages to display
  const stages = [
    TransactionStage.INITIATED,
    TransactionStage.CRYPTO_CALCULATED,
    TransactionStage.SIGNING,
    TransactionStage.SWAP_INITIATED,
    TransactionStage.SWAP_CONFIRMED,
    TransactionStage.SETTLEMENT_PROCESSING,
    TransactionStage.BANK_TRANSFER_INITIATED,
    TransactionStage.COMPLETED,
  ];

  // Poll for transaction progress
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await BackendApiService.getCryptoToNairaTransactionStatus(transactionId);
        
        if (status.progress) {
          setProgress(status.progress);
          setCurrentStage(status.currentStage);

          if (status.currentStage === TransactionStage.COMPLETED) {
            setLoading(false);
            Alert.alert('Success', 'Transaction completed!', [
              {
                text: 'Done',
                onPress: onComplete,
              },
            ]);
          } else if (status.currentStage === TransactionStage.FAILED) {
            setLoading(false);
            setError(status.errorMessage || 'Transaction failed');
            onError(error || 'Unknown error');
          }
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [transactionId]);

  /**
   * Get stage display info
   */
  const getStageInfo = (stage: TransactionStage): { label: string; icon: string } => {
    const stageInfoMap: Record<TransactionStage, { label: string; icon: string }> = {
      [TransactionStage.INITIATED]: { label: 'Transaction Started', icon: '🚀' },
      [TransactionStage.CRYPTO_CALCULATED]: { label: 'Calculating Crypto', icon: '🧮' },
      [TransactionStage.SIGNING]: { label: 'Waiting for Signature', icon: '✍️' },
      [TransactionStage.SWAP_INITIATED]: { label: 'Swap Processing', icon: '⚙️' },
      [TransactionStage.SWAP_CONFIRMED]: { label: 'Swap Confirmed', icon: '✓' },
      [TransactionStage.SETTLEMENT_PROCESSING]: { label: 'Processing Settlement', icon: '🔄' },
      [TransactionStage.BANK_TRANSFER_INITIATED]: { label: 'Bank Transfer', icon: '🏦' },
      [TransactionStage.COMPLETED]: { label: 'Completed', icon: '✅' },
      [TransactionStage.FAILED]: { label: 'Failed', icon: '❌' },
      [TransactionStage.CANCELLED]: { label: 'Cancelled', icon: '⛔' },
    };

    return stageInfoMap[stage] || { label: 'Unknown', icon: '❓' };
  };

  /**
   * Check if stage is completed
   */
  const isStageCompleted = (stage: TransactionStage): boolean => {
    const currentStageIndex = stages.indexOf(currentStage || TransactionStage.INITIATED);
    const stageIndex = stages.indexOf(stage);
    return stageIndex < currentStageIndex;
  };

  /**
   * Check if stage is current
   */
  const isStageCurrent = (stage: TransactionStage): boolean => {
    return stage === currentStage;
  };

  /**
   * Get current progress percentage
   */
  const getProgressPercentage = (): number => {
    if (!currentStage) return 0;
    const currentIndex = stages.indexOf(currentStage);
    return Math.round(((currentIndex + 1) / stages.length) * 100);
  };

  /**
   * Get status message for current stage
   */
  const getCurrentStatusMessage = (): string => {
    const lastProgress = progress[progress.length - 1];
    if (lastProgress) {
      return lastProgress.message;
    }
    return 'Starting transaction...';
  };

  /**
   * Handle retry
   */
  const handleRetry = async () => {
    try {
      setRetrying(true);
      setError(null);
      // This would call a backend endpoint to retry the transaction
      // await BackendApiService.retryTransaction(transactionId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to retry');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transaction Status</Text>
        <Text style={styles.subtitle}>Transaction ID: {transactionId.slice(0, 15)}...</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${getProgressPercentage()}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
        </View>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>⏳</Text>
          <Text style={styles.statusMessage}>{getCurrentStatusMessage()}</Text>
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 10 }} />
        </View>

        {/* Stages Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.timelineTitle}>Progress</Text>
          {stages.map((stage, index) => (
            <View key={stage}>
              <View style={styles.stageRow}>
                {/* Stage Indicator */}
                <View style={styles.stageIndicatorContainer}>
                  <View
                    style={[
                      styles.stageIndicator,
                      isStageCompleted(stage) && styles.stageIndicatorCompleted,
                      isStageCurrent(stage) && styles.stageIndicatorCurrent,
                    ]}
                  >
                    {isStageCompleted(stage) ? (
                      <Text style={styles.stageIndicatorText}>✓</Text>
                    ) : isStageCurrent(stage) ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.stageIndicatorEmpty}></Text>
                    )}
                  </View>

                  {/* Connector Line */}
                  {index < stages.length - 1 && (
                    <View
                      style={[
                        styles.stageConnector,
                        isStageCompleted(stages[index + 1]) && styles.stageConnectorCompleted,
                      ]}
                    />
                  )}
                </View>

                {/* Stage Content */}
                <View style={styles.stageContent}>
                  <Text
                    style={[
                      styles.stageName,
                      isStageCompleted(stage) && styles.stageNameCompleted,
                      isStageCurrent(stage) && styles.stageNameCurrent,
                    ]}
                  >
                    {getStageInfo(stage).icon} {getStageInfo(stage).label}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Transaction Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={retrying}
            >
              {retrying ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.retryButtonText}>Retry Transaction</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Details Log */}
        <View style={styles.detailsSection}>
          <Text style={styles.detailsTitle}>Details</Text>
          <View style={styles.detailsList}>
            {progress.map((item, index) => (
              <View key={index} style={styles.detailsItem}>
                <Text style={styles.detailsTime}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={styles.detailsMessage}>{item.message}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 What's happening</Text>
          <Text style={styles.infoText}>
            Your transaction is being processed through multiple stages. Do not close this
            screen or the app while the transaction is pending. The process typically takes
            2-5 minutes.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },

  content: {
    flex: 1,
    padding: 16,
  },

  // Progress Section
  progressSection: {
    marginBottom: 24,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#EEE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },

  // Status Card
  statusCard: {
    backgroundColor: '#E7F3FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0051BA',
    textAlign: 'center',
  },

  // Timeline Section
  timelineSection: {
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  stageRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  stageIndicatorContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 40,
  },
  stageIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIndicatorCompleted: {
    borderColor: '#34C759',
    backgroundColor: '#34C759',
  },
  stageIndicatorCurrent: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  stageIndicatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  stageIndicatorEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  stageConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#DDD',
    marginTop: 2,
  },
  stageConnectorCompleted: {
    backgroundColor: '#34C759',
  },
  stageContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  stageName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  stageNameCompleted: {
    color: '#34C759',
    fontWeight: '600',
  },
  stageNameCurrent: {
    color: '#007AFF',
    fontWeight: '600',
  },

  // Error Card
  errorCard: {
    backgroundColor: '#FFE5E5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C92A2A',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#C92A2A',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },

  // Details Section
  detailsSection: {
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  detailsList: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  detailsItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailsTime: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  detailsMessage: {
    fontSize: 12,
    color: '#666',
  },

  // Info Box
  infoBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
});

export default TransactionStatusScreen;
