/**
 * Transaction Review Screen
 * 
 * Third step in transaction flow:
 * - Display complete transaction breakdown
 * - Show all fees and calculations
 * - Confirm before signing
 * - Display estimated settlement time
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from 'react-native';

interface TransactionReviewProps {
  data: {
    nairaAmount: number;
    cryptoToken: string;
    cryptoAmount: number;
    gasFee: number;
    exchangeRate: number;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  onConfirm: () => void;
  onBack: () => void;
}

const TransactionReviewScreen: React.FC<TransactionReviewProps> = ({
  data,
  onConfirm,
  onBack,
}) => {
  const [confirming, setConfirming] = useState(false);

  const totalCrypto = data.cryptoAmount + data.gasFee;

  const handleConfirm = async () => {
    try {
      Alert.alert(
        'Confirm Transaction',
        `You're about to send ${totalCrypto.toFixed(6)} ${data.cryptoToken} (≈ ₦${data.nairaAmount.toLocaleString()}) to ${data.accountName}`,
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Confirm & Sign',
            onPress: async () => {
              setConfirming(true);
              try {
                await onConfirm();
              } finally {
                setConfirming(false);
              }
            },
            style: 'destructive',
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to confirm');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          disabled={confirming}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Transaction</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Main Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>You're sending</Text>
          <Text style={styles.amountValue}>₦{data.nairaAmount.toLocaleString()}</Text>
          <Text style={styles.amountSubtext}>
            ≈ {totalCrypto.toFixed(6)} {data.cryptoToken}
          </Text>
        </View>

        {/* Recipient Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>To:</Text>
          <View style={styles.recipientCard}>
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>{data.accountName}</Text>
              <Text style={styles.recipientBank}>{data.bankName}</Text>
              <Text style={styles.recipientAccount}>{data.accountNumber}</Text>
            </View>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        </View>

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown</Text>

          {/* Crypto Amount */}
          <View style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>Crypto to Send</Text>
              <Text style={styles.breakdownSubtext}>
                @ ₦{data.exchangeRate.toLocaleString()} per {data.cryptoToken}
              </Text>
            </View>
            <Text style={styles.breakdownValue}>
              {data.cryptoAmount.toFixed(6)} {data.cryptoToken}
            </Text>
          </View>

          {/* Gas Fee */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Gas Fee</Text>
            <Text style={styles.breakdownValue}>
              {data.gasFee.toFixed(6)} {data.cryptoToken}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Crypto Needed</Text>
            <Text style={styles.totalValue}>
              {totalCrypto.toFixed(6)} {data.cryptoToken}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <View style={styles.timeline}>
            {/* Step 1 */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineNumber}>
                <Text style={styles.timelineNumberText}>1</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Sign & Submit</Text>
                <Text style={styles.timelineSubtext}>
                  Sign the transaction with your account
                </Text>
              </View>
            </View>

            {/* Connector */}
            <View style={styles.timelineConnector} />

            {/* Step 2 */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineNumber}>
                <Text style={styles.timelineNumberText}>2</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Swap on Blockchain</Text>
                <Text style={styles.timelineSubtext}>
                  Convert {data.cryptoToken} to stablecoin (USDC)
                </Text>
              </View>
            </View>

            {/* Connector */}
            <View style={styles.timelineConnector} />

            {/* Step 3 */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineNumber}>
                <Text style={styles.timelineNumberText}>3</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Bank Transfer</Text>
                <Text style={styles.timelineSubtext}>
                  Naira settled to recipient's account
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Estimated Time */}
        <View style={styles.section}>
          <View style={styles.timeBox}>
            <Text style={styles.timeIcon}>⏱️</Text>
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Estimated Settlement</Text>
              <Text style={styles.timeValue}>2-5 minutes</Text>
            </View>
          </View>
        </View>

        {/* Terms & Conditions */}
        <View style={styles.section}>
          <View style={styles.termsBox}>
            <Text style={styles.termsText}>
              By confirming, you agree to our Terms of Service and acknowledge that this
              transaction cannot be reversed once initiated.
            </Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Tips</Text>
          <Text style={styles.infoText}>
            • Make sure the recipient's account name matches {'\n'}
            • Keep your private key secure {'\n'}
            • Transaction is irreversible once confirmed
          </Text>
        </View>
      </ScrollView>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backBtn]}
          onPress={onBack}
          disabled={confirming}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.confirmBtn]}
          onPress={handleConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Sign & Confirm</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },

  content: {
    flex: 1,
    padding: 16,
  },

  // Amount Box
  amountBox: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  amountSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Recipient Card
  recipientCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recipientBank: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  recipientAccount: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  checkmark: {
    fontSize: 24,
    color: '#34C759',
    marginLeft: 12,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  breakdownSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },

  // Timeline
  timeline: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'center',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  timelineSubtext: {
    fontSize: 12,
    color: '#999',
  },
  timelineConnector: {
    width: 2,
    height: 24,
    backgroundColor: '#DDD',
    marginLeft: 15,
    marginBottom: 0,
  },

  // Time Box
  timeBox: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  timeContent: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // Terms Box
  termsBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  termsText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },

  // Info Section
  infoSection: {
    backgroundColor: '#E7F3FF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0051BA',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#0051BA',
    lineHeight: 20,
  },

  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtn: {
    backgroundColor: '#007AFF',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default TransactionReviewScreen;
