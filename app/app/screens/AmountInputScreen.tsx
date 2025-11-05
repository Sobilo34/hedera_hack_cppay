/**
 * Crypto-to-Naira Amount Input Screen
 * 
 * First step in the transaction flow:
 * - User enters desired naira amount
 * - System calculates crypto needed
 * - Shows gas fees and total crypto required
 * - User selects crypto token to send from
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput } from 'react-native';
import BackendApiService from '../../services/BackendApiService';
import { useBalances } from '../../hooks/useBalances';

interface AmountInputProps {
  chainId: number;
  onNext: (data: {
    nairaAmount: number;
    cryptoToken: string;
    cryptoAmount: number;
    gasFee: number;
    exchangeRate: number;
  }) => void;
  onCancel: () => void;
}

const AmountInputScreen: React.FC<AmountInputProps> = ({ chainId, onNext, onCancel }) => {
  // State management
  const [nairaAmount, setNairaAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [cryptoAmount, setCryptoAmount] = useState<number | null>(null);
  const [gasFee, setGasFee] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's balances
  const { balances } = useBalances();

  // Available tokens
  const availableTokens = ['ETH', 'USDC', 'USDT', 'DAI'];

  // Calculate crypto needed when naira amount changes
  useEffect(() => {
    if (nairaAmount && Number(nairaAmount) > 0) {
      calculateCryptoNeeded();
    } else {
      setCryptoAmount(null);
      setGasFee(null);
    }
  }, [nairaAmount, selectedToken]);

  /**
   * Calculate crypto needed for fiat amount
   */
  const calculateCryptoNeeded = async () => {
    try {
      setCalculating(true);
      setError(null);

      const result = await BackendApiService.calculateCryptoNeeded({
        cryptoToken: selectedToken,
        nairaAmount: Number(nairaAmount),
        chainId,
      });

      setCryptoAmount(result.cryptoAmount);
      setGasFee(result.gasFee);
      setExchangeRate(result.exchangeRate);
    } catch (err) {
      console.error('Failed to calculate crypto:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate crypto needed');
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Get user's balance for selected token
   */
  const getUserBalance = (): number => {
    // This would be retrieved from the balance store
    // For now, return a placeholder
    return 10.5; // Example: 10.5 ETH
  };

  /**
   * Check if user has sufficient balance
   */
  const hassufficientBalance = (): boolean => {
    if (!cryptoAmount) return false;
    return getUserBalance() >= cryptoAmount;
  };

  /**
   * Handle continue button press
   */
  const handleContinue = async () => {
    try {
      // Validate inputs
      if (!nairaAmount || Number(nairaAmount) <= 0) {
        Alert.alert('Error', 'Please enter a valid naira amount');
        return;
      }

      if (!cryptoAmount || !gasFee || !exchangeRate) {
        Alert.alert('Error', 'Please wait for calculation to complete');
        return;
      }

      if (!hassufficientBalance()) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${cryptoAmount + gasFee} ${selectedToken} but only have ${getUserBalance()} ${selectedToken}`
        );
        return;
      }

      setLoading(true);

      // Pass data to next screen
      onNext({
        nairaAmount: Number(nairaAmount),
        cryptoToken: selectedToken,
        cryptoAmount,
        gasFee,
        exchangeRate,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to proceed');
    } finally {
      setLoading(false);
    }
  };

  const totalCryptoNeeded = cryptoAmount && gasFee ? cryptoAmount + gasFee : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Send Crypto as Naira</Text>
          <Text style={styles.subtitle}>Enter the amount in naira you want to send</Text>
        </View>

        {/* Naira Amount Input */}
        <View style={styles.amountSection}>
          <Text style={styles.label}>Naira Amount</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.currencyPrefix}>₦</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter naira amount"
              keyboardType="decimal-pad"
              value={nairaAmount}
              onChangeText={setNairaAmount}
              editable={!calculating}
              placeholderTextColor="#999"
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        {/* Token Selector */}
        <View style={styles.tokenSection}>
          <Text style={styles.label}>Pay With</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tokenList}
          >
            {availableTokens.map((token) => (
              <TouchableOpacity
                key={token}
                style={[
                  styles.tokenButton,
                  selectedToken === token && styles.tokenButtonActive,
                ]}
                onPress={() => setSelectedToken(token)}
              >
                <Text
                  style={[
                    styles.tokenButtonText,
                    selectedToken === token && styles.tokenButtonTextActive,
                  ]}
                >
                  {token}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.balanceText}>
            Balance: {getUserBalance()} {selectedToken}
          </Text>
        </View>

        {/* Calculation Results */}
        {calculating && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Calculating crypto needed...</Text>
          </View>
        )}

        {cryptoAmount !== null && !calculating && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Transaction Summary</Text>

            {/* Exchange Rate */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Exchange Rate</Text>
              <Text style={styles.summaryValue}>
                1 {selectedToken} = ₦{exchangeRate?.toLocaleString()}
              </Text>
            </View>

            {/* Crypto Needed */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Crypto Amount</Text>
              <Text style={styles.summaryValue}>
                {cryptoAmount.toFixed(6)} {selectedToken}
              </Text>
            </View>

            {/* Gas Fee */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Gas Fee</Text>
              <Text style={styles.summaryValue}>
                {gasFee.toFixed(6)} {selectedToken}
              </Text>
            </View>

            {/* Total */}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Needed</Text>
              <Text style={styles.totalValue}>
                {totalCryptoNeeded?.toFixed(6)} {selectedToken}
              </Text>
            </View>

            {/* Insufficient Balance Warning */}
            {!hassufficientBalance() && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Insufficient balance. You need{' '}
                  {(totalCryptoNeeded! - getUserBalance()).toFixed(6)} more {selectedToken}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.continueButton,
              (!cryptoAmount || !hassufficientBalance() || loading) && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!cryptoAmount || !hassufficientBalance() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },

  // Amount Section
  amountSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 15,
    height: 55,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  error: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
  },

  // Token Section
  tokenSection: {
    marginBottom: 30,
  },
  tokenList: {
    marginBottom: 12,
  },
  tokenButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  tokenButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tokenButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tokenButtonTextActive: {
    color: '#FFF',
  },
  balanceText: {
    fontSize: 12,
    color: '#999',
  },

  // Loading Section
  loadingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: '#666',
  },

  // Summary Section
  summarySection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },

  // Warning Box
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },

  // Buttons
  buttonSection: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#007AFF',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default AmountInputScreen;
