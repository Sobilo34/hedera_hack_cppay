/**
 * Bank Recipient Screen
 * 
 * Second step in transaction flow:
 * - Select recipient bank
 * - Enter account number
 * - Verify account name
 * - Save as favorite (optional)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Text, TextInput } from 'react-native';
import BackendApiService from '../../services/BackendApiService';

interface Bank {
  code: string;
  name: string;
}

interface BankRecipientProps {
  onNext: (data: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => void;
  onBack: () => void;
}

const BankRecipientScreen: React.FC<BankRecipientProps> = ({ onNext, onBack }) => {
  // State
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load banks on mount
  useEffect(() => {
    loadBanks();
  }, []);

  /**
   * Load list of banks
   */
  const loadBanks = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await BackendApiService.getBanks();
      setBanks(result.banks || []);
    } catch (err) {
      console.error('Failed to load banks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load banks');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validate bank account
   */
  const validateBankAccount = async () => {
    try {
      if (!selectedBank || !accountNumber) {
        Alert.alert('Error', 'Please select a bank and enter account number');
        return;
      }

      setValidating(true);
      setError(null);

      const response = await BackendApiService.validateBankAccount(
        selectedBank.code,
        accountNumber
      );

      if (!response.valid) {
        setError('Invalid bank account');
        return;
      }

      // Set account name from validation response
      if (response.accountName) {
        setAccountName(response.accountName);
      }

      // Account is valid, ready to proceed
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Validation failed';
      setError(errorMsg);
      console.error('Bank validation error:', err);
      return false;
    } finally {
      setValidating(false);
    }
  };

  /**
   * Handle continue button press
   */
  const handleContinue = async () => {
    try {
      // Validate account
      const isValid = await validateBankAccount();
      if (!isValid) {
        return;
      }

      if (!accountName.trim()) {
        Alert.alert('Error', 'Please verify account name');
        return;
      }

      // Pass data to next screen
      onNext({
        bankCode: selectedBank!.code,
        bankName: selectedBank!.name,
        accountNumber,
        accountName,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to proceed');
    }
  };

  /**
   * Filter banks based on search query
   */
  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bank.code.includes(searchQuery)
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Recipient Bank</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.content, styles.centerContent]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading banks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recipient Bank</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Instructions */}
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsText}>
            Confirm the recipient's bank account details
          </Text>
        </View>

        {/* Bank Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Bank</Text>
          <TouchableOpacity
            style={[styles.input, !selectedBank && styles.inputPlaceholder]}
            onPress={() => setShowBankModal(true)}
          >
            <Text
              style={[
                styles.inputText,
                !selectedBank && styles.inputPlaceholderText,
              ]}
            >
              {selectedBank ? selectedBank.name : 'Choose a bank...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account Number */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 10-digit account number"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={accountNumber}
            onChangeText={setAccountNumber}
            editable={!validating}
            maxLength={10}
          />
        </View>

        {/* Account Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Name</Text>
          <Text style={styles.helpText}>
            {accountName
              ? 'Verified from your bank'
              : 'Will be automatically filled after validation'}
          </Text>
          <View style={[styles.input, styles.readOnlyInput]}>
            <Text
              style={[
                styles.inputText,
                !accountName && styles.inputPlaceholderText,
              ]}
            >
              {accountName || 'Validating...'}
            </Text>
            {validating && <ActivityIndicator size="small" color="#007AFF" />}
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Security Note</Text>
          <Text style={styles.infoText}>
            We verify all bank account details to prevent transfer to wrong accounts. The
            recipient's name must match the account name at their bank.
          </Text>
        </View>
      </ScrollView>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backBtn]}
          onPress={onBack}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.continueBtn,
            (!selectedBank || !accountNumber || !accountName || validating) &&
              styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedBank || !accountNumber || !accountName || validating}
        >
          {validating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.continueBtnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Bank Selection Modal */}
      <Modal
        visible={showBankModal}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBankModal(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Bank</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search bank name or code"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Bank List */}
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.bankItem}
                onPress={() => {
                  setSelectedBank(item);
                  setShowBankModal(false);
                  setAccountName(''); // Reset account name when bank changes
                }}
              >
                <View style={styles.bankItemContent}>
                  <Text style={styles.bankItemName}>{item.name}</Text>
                  <Text style={styles.bankItemCode}>{item.code}</Text>
                </View>
                {selectedBank?.code === item.code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No banks found</Text>
              </View>
            }
          />
        </View>
      </Modal>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // Instructions
  instructionsBox: {
    backgroundColor: '#E7F3FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  instructionsText: {
    fontSize: 13,
    color: '#0051BA',
    fontWeight: '500',
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },

  // Input
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 44,
  },
  inputText: {
    fontSize: 14,
    color: '#333',
  },
  inputPlaceholder: {
    justifyContent: 'center',
  },
  inputPlaceholderText: {
    color: '#999',
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
  },

  // Error & Info Boxes
  errorBox: {
    backgroundColor: '#FFE5E5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#C92A2A',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
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
  continueBtn: {
    backgroundColor: '#007AFF',
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bankItemContent: {
    flex: 1,
  },
  bankItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  bankItemCode: {
    fontSize: 12,
    color: '#999',
  },
  checkmark: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
});

export default BankRecipientScreen;
