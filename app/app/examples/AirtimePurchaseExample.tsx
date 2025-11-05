/**
 * UI Integration Example for Airtime Purchase Screen
 * Shows how to integrate AirtimePurchaseService into a React Native screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useWalletStore } from '@/store/walletStore';
import AirtimePurchaseService from '@/services/features/AirtimePurchaseService';
import type { Address, Hex } from 'viem';

export default function AirtimePurchaseScreen() {
  const { wallet } = useWalletStore();
  
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('MTN');
  const [paymentToken, setPaymentToken] = useState('USDT');
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>('');

  const handlePurchase = async () => {
    // Validation
    if (!phoneNumber || !amount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (!wallet.address || !wallet.smartAccount?.address) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }

    setIsProcessing(true);
    setTransactionStatus('Estimating payment...');

    try {
      // Get private key from secure storage
      const { default: SecureWalletStorage } = await import('@/services/SecureWalletStorage');
      const privateKey = await SecureWalletStorage.getPrivateKey('password');

      if (!privateKey) {
        throw new Error('Private key not found');
      }

      // Call airtime purchase service
      setTransactionStatus('Creating transaction...');
      const result = await AirtimePurchaseService.purchaseAirtime({
        smartWalletAddress: wallet.smartAccount.address as Address,
        privateKey: privateKey as Hex,
        phoneNumber,
        amountNGN: parseFloat(amount),
        provider,
        paymentToken,
      });

      if (result.success) {
        Alert.alert(
          'Success!',
          `Airtime purchased successfully!\nTransaction: ${result.transactionHash?.slice(0, 10)}...`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back or refresh
                setPhoneNumber('');
                setAmount('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Failed', result.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsProcessing(false);
      setTransactionStatus('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Airtime</Text>

      {/* Provider Selection */}
      <View style={styles.providerRow}>
        {(['MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.providerButton,
              provider === p && styles.providerButtonActive,
            ]}
            onPress={() => setProvider(p)}
          >
            <Text
              style={[
                styles.providerText,
                provider === p && styles.providerTextActive,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Phone Number Input */}
      <TextInput
        style={styles.input}
        placeholder="Phone Number (e.g., 08012345678)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        maxLength={11}
      />

      {/* Amount Input */}
      <TextInput
        style={styles.input}
        placeholder="Amount (NGN)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {/* Payment Token Selection */}
      <View style={styles.tokenRow}>
        {['USDT', 'USDC', 'ETH', 'CNGN'].map((token) => (
          <TouchableOpacity
            key={token}
            style={[
              styles.tokenButton,
              paymentToken === token && styles.tokenButtonActive,
            ]}
            onPress={() => setPaymentToken(token)}
          >
            <Text style={styles.tokenText}>{token}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction Status */}
      {isProcessing && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#0066FF" />
          <Text style={styles.statusText}>{transactionStatus}</Text>
        </View>
      )}

      {/* Purchase Button */}
      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handlePurchase}
        disabled={isProcessing}
      >
        <Text style={styles.buttonText}>
          {isProcessing ? 'Processing...' : 'Purchase Airtime'}
        </Text>
      </TouchableOpacity>

      {/* Info Text */}
      <Text style={styles.infoText}>
        Estimated time: 30 seconds{'\n'}
        Gas fees may be sponsored based on your KYC tier
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  providerButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  providerButtonActive: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  providerText: {
    fontSize: 12,
    color: '#666',
  },
  providerTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tokenButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tokenButtonActive: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  tokenText: {
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#0066FF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    marginTop: 16,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
