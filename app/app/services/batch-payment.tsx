/**
 * Batch Payment Screen
 * 
 * Allows users to send crypto-to-naira payments to multiple recipients in a single transaction.
 * Uses Account Abstraction for efficient batch processing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

// Services
import PaystackService, { NigerianBank } from '@/services/PaystackService';
import TokenBalanceService from '@/services/TokenBalanceService';
import PriceService from '@/services/PriceService';
import SecureWalletStorage from '@/services/SecureWalletStorage';
import BatchPaymentService, { BatchRecipient, BatchPaymentRequest } from '@/services/BatchPaymentService';

// Types
interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: string;
  address: string;
  decimals: number;
  logo?: string;
}

interface TransactionStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
  error?: string;
}

export default function BatchPaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
  const [transactionSteps, setTransactionSteps] = useState<TransactionStep[]>([
    { id: 1, title: 'Recipients', description: 'Add multiple recipients', completed: false, active: true },
    { id: 2, title: 'Token Selection', description: 'Choose crypto to convert', completed: false, active: false },
    { id: 3, title: 'Review & Calculate', description: 'Review batch and calculate', completed: false, active: false },
    { id: 4, title: 'Execute Batch', description: 'Sign and submit batch', completed: false, active: false },
    { id: 5, title: 'Completion', description: 'Batch processing', completed: false, active: false },
  ]);

  // Recipients management
  const [recipients, setRecipients] = useState<BatchRecipient[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [batchMemo, setBatchMemo] = useState('');

  // Transaction calculation
  const [totalNairaAmount, setTotalNairaAmount] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [totalCryptoNeeded, setTotalCryptoNeeded] = useState(0);
  const [gasEstimate, setGasEstimate] = useState(0);
  const [transactionFee, setTransactionFee] = useState(0);

  // Modal states
  const [showBankModal, setShowBankModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Transaction processing
  const [batchId, setBatchId] = useState<string>('');
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [batchProgress, setBatchProgress] = useState<{
    completedRecipients: number;
    totalRecipients: number;
    currentRecipient?: string;
  }>({ completedRecipients: 0, totalRecipients: 0 });

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBanks(),
        loadUserTokens(),
      ]);
    } catch (error) {
      console.error('Failed to initialize data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadBanks = async () => {
    try {
      const bankList = await PaystackService.getBanks();
      setBanks(bankList);
    } catch (error: any) {
      console.error('Failed to load banks:', error);
      Alert.alert('Error', 'Failed to load banks: ' + error.message);
    }
  };

  const loadUserTokens = async () => {
    try {
      const address = await SecureWalletStorage.getAddress();
      if (!address) {
        throw new Error('No wallet address found');
      }

      const tokens = await TokenBalanceService.getPortfolioBalances(address);
      
      // Filter tokens with balance > 0
      const tokensWithBalance = tokens.filter(token => 
        parseFloat(token.balance) > 0
      );
      
      setUserTokens(tokensWithBalance);
    } catch (error: any) {
      console.error('Failed to load user tokens:', error);
      Alert.alert('Error', 'Failed to load your tokens: ' + error.message);
    }
  };

  const updateStepStatus = (stepId: number, completed: boolean, active: boolean, error?: string) => {
    setTransactionSteps(prev => 
      prev.map(step => 
        step.id === stepId 
          ? { ...step, completed, active, error }
          : step.id === stepId + 1 && completed
          ? { ...step, active: true }
          : step.id < stepId
          ? { ...step, active: false }
          : step
      )
    );
  };

  // Step 1: Add Recipients
  const addRecipient = () => {
    const newRecipient: BatchRecipient = {
      id: `recipient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bankCode: '',
      accountNumber: '',
      accountName: '',
      nairaAmount: 0,
      memo: '',
    };
    
    setRecipients(prev => [...prev, newRecipient]);
  };

  const updateRecipient = (id: string, updates: Partial<BatchRecipient>) => {
    setRecipients(prev => 
      prev.map(recipient => 
        recipient.id === id ? { ...recipient, ...updates } : recipient
      )
    );
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(recipient => recipient.id !== id));
  };

  const verifyRecipientAccount = async (recipient: BatchRecipient) => {
    if (!recipient.bankCode || !recipient.accountNumber) {
      Alert.alert('Error', 'Please select bank and enter account number');
      return;
    }

    if (recipient.accountNumber.length !== 10) {
      Alert.alert('Error', 'Account number must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      const verification = await PaystackService.verifyBankAccount(
        recipient.accountNumber,
        recipient.bankCode
      );
      
      updateRecipient(recipient.id, { accountName: verification.account_name });
      
      Alert.alert(
        'Account Verified ✅',
        `Account Name: ${verification.account_name}`,
        [{ text: 'Continue' }]
      );
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateRecipients = (): boolean => {
    if (recipients.length === 0) {
      Alert.alert('Error', 'Please add at least one recipient');
      return false;
    }

    // for (const recipient of recipients) {
    //   if (!recipient.bankCode) {
    //     Alert.alert('Error', 'Please select bank for all recipients');
    //     return false;
    //   }
    //   if (!recipient.accountNumber || recipient.accountNumber.length !== 10) {
    //     Alert.alert('Error', 'Please enter valid account numbers for all recipients');
    //     return false;
    //   }
    //   if (!recipient.accountName) {
    //     Alert.alert('Error', 'Please verify account names for all recipients');
    //     return false;
    //   }
    //   if (recipient.nairaAmount <= 0) {
    //     Alert.alert('Error', 'Please enter valid amounts for all recipients');
    //     return false;
    //   }
    // }

    return true;
  };

  // Step 2: Token Selection
  const handleTokenSelection = (token: TokenBalance) => {
    setSelectedToken(token);
    setShowTokenModal(false);
    updateStepStatus(2, true, false);
    setCurrentStep(3);
  };

  // Step 3: Calculate Batch Transaction
  const calculateBatchTransaction = useCallback(async () => {
    if (!selectedToken || recipients.length === 0) {
      return;
    }

    try {
      setLoading(true);
      
      // Calculate total naira amount
      const totalNaira = recipients.reduce((sum, recipient) => sum + recipient.nairaAmount, 0);
      setTotalNairaAmount(totalNaira);
      
      // Get current exchange rate
      const tokenPrice = await PriceService.getTokenPrice(selectedToken.symbol, 'ngn');
      const rate = parseFloat(tokenPrice.price);
      setExchangeRate(rate);
      
      // Calculate crypto amount needed
      const cryptoForPayments = totalNaira / rate;
      
      // Estimate gas fees (batch transaction)
      const gasEstimateWei = await estimateBatchGasFee(recipients.length);
      setGasEstimate(gasEstimateWei);
      
      // Calculate total crypto needed (including gas)
      const total = cryptoForPayments + gasEstimateWei;
      setTotalCryptoNeeded(total);
      
      // Get Paystack transfer fees
      const feeInfo = await PaystackService.getTransferFees(totalNaira);
      setTransactionFee(feeInfo.fee);
      
      // Check if user has enough balance
      const userBalance = parseFloat(selectedToken.balance);
      if (userBalance < total) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${total.toFixed(6)} ${selectedToken.symbol} but only have ${userBalance.toFixed(6)} ${selectedToken.symbol}`
        );
        return;
      }
      
    } catch (error: any) {
      console.error('Failed to calculate batch transaction:', error);
      Alert.alert('Error', 'Failed to calculate batch transaction: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedToken, recipients]);

  useEffect(() => {
    if (currentStep === 3) {
      calculateBatchTransaction();
    }
  }, [currentStep, calculateBatchTransaction]);

  const estimateBatchGasFee = async (recipientCount: number): Promise<number> => {
    // Base gas + additional gas per recipient
    const baseGas = 0.01; // Base gas cost
    const perRecipientGas = 0.002; // Additional gas per recipient
    
    return baseGas + (perRecipientGas * recipientCount);
  };

  // Step 4: Execute Batch Transaction
  const executeBatchTransaction = async () => {
    if (!selectedToken || recipients.length === 0) {
      Alert.alert('Error', 'Missing required transaction data');
      return;
    }

    const request: BatchPaymentRequest = {
      recipients,
      selectedToken: {
        symbol: selectedToken.symbol,
        address: selectedToken.address,
        decimals: selectedToken.decimals,
      },
      totalNairaAmount,
      memo: batchMemo,
    };

    setShowTransactionModal(true);
    updateStepStatus(4, false, true);
    
    try {
      const batchService = new BatchPaymentService(4202); // Lisk Sepolia testnet
      
      setTransactionStatus('Preparing batch transaction...');
      
      // Execute batch crypto-to-naira transaction
      const result = await batchService.executeBatchPayment(request);
      
      setBatchId(result.batchId);
      setBatchProgress({
        completedRecipients: 0,
        totalRecipients: result.individualResults.length,
      });
      setTransactionStatus('Batch transaction submitted ✅');
      
      // Monitor batch progress
      await monitorBatchProgress(result.batchId);
      
      updateStepStatus(4, true, false);
      setCurrentStep(5);
      
    } catch (error: any) {
      console.error('Batch transaction failed:', error);
      updateStepStatus(4, false, false, error.message);
      setTransactionStatus(`Failed: ${error.message}`);
      Alert.alert('Batch Transaction Failed', error.message);
    }
  };

  const monitorBatchProgress = async (batchId: string) => {
    const batchService = new BatchPaymentService(4202);
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      const progress = await batchService.getBatchStatus(batchId);
      
      if (!progress) {
        throw new Error('Batch transaction not found');
      }
      
      setBatchProgress({
        completedRecipients: progress.completedRecipients,
        totalRecipients: progress.totalRecipients,
        currentRecipient: progress.currentRecipient,
      });
      
      setTransactionStatus(progress.status);
      
      if (progress.status === 'completed') {
        return; // Batch complete
      }
      
      if (progress.status === 'failed') {
        throw new Error(progress.error || 'Batch transaction failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Batch transaction monitoring timeout');
  };

  // UI Rendering Methods
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {transactionSteps.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            step.completed && styles.stepCompleted,
            step.active && styles.stepActive,
            step.error && styles.stepError,
          ]}>
            {step.completed ? (
              <MaterialCommunityIcons name="check" size={16} color="white" />
            ) : step.error ? (
              <MaterialCommunityIcons name="close" size={16} color="white" />
            ) : (
              <Text style={styles.stepNumber}>{step.id}</Text>
            )}
          </View>
          {index < transactionSteps.length - 1 && (
            <View style={[
              styles.stepLine,
              step.completed && styles.stepLineCompleted,
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderRecipientsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Recipients</Text>
      
      <View style={styles.recipientsHeader}>
        <Text style={styles.recipientsCount}>
          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={addRecipient}>
          <MaterialCommunityIcons name="plus" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Recipient</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.recipientsList} showsVerticalScrollIndicator={false}>
        {recipients.map((recipient, index) => (
          <RecipientCard
            key={recipient.id}
            recipient={recipient}
            banks={banks}
            index={index + 1}
            onUpdate={(updates) => updateRecipient(recipient.id, updates)}
            onRemove={() => removeRecipient(recipient.id)}
            onVerify={() => verifyRecipientAccount(recipient)}
          />
        ))}
      </ScrollView>

      {recipients.length > 0 && (
        <TouchableOpacity
          style={[styles.button, !validateRecipients() && styles.buttonDisabled]}
          onPress={() => {
            if (validateRecipients()) {
              updateStepStatus(1, true, false);
              setCurrentStep(2);
            }
          }}
          disabled={!validateRecipients()}
        >
          <Text style={styles.buttonText}>Continue to Token Selection</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTokenSelectionStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Token to Convert</Text>
      
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowTokenModal(true)}
      >
        <Text style={styles.selectorLabel}>Token</Text>
        <View style={styles.tokenInfo}>
          {selectedToken ? (
            <>
              <Text style={styles.selectorValue}>{selectedToken.symbol}</Text>
              <Text style={styles.tokenBalance}>
                Balance: {parseFloat(selectedToken.balance).toFixed(4)}
              </Text>
            </>
          ) : (
            <Text style={styles.selectorValue}>Select Token</Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !selectedToken && styles.buttonDisabled]}
        onPress={() => {
          if (selectedToken) {
            updateStepStatus(2, true, false);
            setCurrentStep(3);
          }
        }}
        disabled={!selectedToken}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Batch Transaction</Text>
      
      <View style={styles.batchSummary}>
        <Text style={styles.summaryTitle}>Batch Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Recipients:</Text>
          <Text style={styles.summaryValue}>{recipients.length}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Amount:</Text>
          <Text style={styles.summaryValue}>₦{totalNairaAmount.toLocaleString()}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Exchange Rate:</Text>
          <Text style={styles.summaryValue}>
            1 {selectedToken?.symbol} = ₦{exchangeRate.toLocaleString()}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Crypto Needed:</Text>
          <Text style={styles.summaryValue}>
            {(totalCryptoNeeded - gasEstimate).toFixed(6)} {selectedToken?.symbol}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Gas Fee:</Text>
          <Text style={styles.summaryValue}>
            {gasEstimate.toFixed(6)} {selectedToken?.symbol}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Paystack Fee:</Text>
          <Text style={styles.summaryValue}>₦{transactionFee}</Text>
        </View>
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Crypto Required:</Text>
          <Text style={styles.totalValue}>
            {totalCryptoNeeded.toFixed(6)} {selectedToken?.symbol}
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.memoInput}
        placeholder="Batch memo (optional)"
        value={batchMemo}
        onChangeText={setBatchMemo}
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[styles.button, totalCryptoNeeded <= 0 && styles.buttonDisabled]}
        onPress={() => {
          updateStepStatus(3, true, false);
          setCurrentStep(4);
        }}
        disabled={totalCryptoNeeded <= 0}
      >
        <Text style={styles.buttonText}>Proceed to Execute Batch</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && currentStep === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.background || '#1a1a1a', colors.cardBackground || '#2a2a2a']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Batch Payment</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {currentStep === 1 && renderRecipientsStep()}
          {currentStep === 2 && renderTokenSelectionStep()}
          {currentStep === 3 && renderReviewStep()}
          {currentStep === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Execute Batch Transaction</Text>
              <TouchableOpacity style={styles.button} onPress={executeBatchTransaction}>
                <Text style={styles.buttonText}>Sign & Send Batch</Text>
              </TouchableOpacity>
            </View>
          )}
          {currentStep === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Batch Complete</Text>
              <Text style={styles.successMessage}>
                Your batch payment has been processed! {batchProgress.completedRecipients}/{batchProgress.totalRecipients} recipients completed.
              </Text>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => router.push('/(tabs)/' as any)}
              >
                <Text style={styles.buttonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        <TokenSelectionModal
          visible={showTokenModal}
          tokens={userTokens}
          onSelect={handleTokenSelection}
          onClose={() => setShowTokenModal(false)}
        />

        <BatchTransactionProgressModal
          visible={showTransactionModal}
          status={transactionStatus}
          batchId={batchId}
          progress={batchProgress}
          onClose={() => setShowTransactionModal(false)}
        />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Recipient Card Component
const RecipientCard = ({ 
  recipient, 
  banks, 
  index, 
  onUpdate, 
  onRemove, 
  onVerify 
}: {
  recipient: BatchRecipient;
  banks: NigerianBank[];
  index: number;
  onUpdate: (updates: Partial<BatchRecipient>) => void;
  onRemove: () => void;
  onVerify: () => void;
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [showBankModal, setShowBankModal] = useState(false);

  const handleBankSelection = (bank: NigerianBank) => {
    onUpdate({ bankCode: bank.code });
    setShowBankModal(false);
  };

  return (
    <View style={styles.recipientCard}>
      <View style={styles.recipientHeader}>
        <Text style={styles.recipientNumber}>#{index}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <MaterialCommunityIcons name="close" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowBankModal(true)}
      >
        <Text style={styles.selectorLabel}>Bank</Text>
        <Text style={styles.selectorValue}>
          {banks.find(b => b.code === recipient.bankCode)?.name || 'Select Bank'}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Account Number (10 digits)"
        value={recipient.accountNumber}
        onChangeText={(text) => onUpdate({ accountNumber: text })}
        keyboardType="numeric"
        maxLength={10}
        placeholderTextColor={colors.textSecondary}
      />

      <TextInput
        style={styles.input}
        placeholder="Amount (₦)"
        value={recipient.nairaAmount > 0 ? recipient.nairaAmount.toString() : ''}
        onChangeText={(text) => onUpdate({ nairaAmount: parseFloat(text) || 0 })}
        keyboardType="numeric"
        placeholderTextColor={colors.textSecondary}
      />

      {recipient.accountName && (
        <View style={styles.verificationResult}>
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
          <Text style={styles.verificationText}>{recipient.accountName}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.verifyButton, (!recipient.bankCode || !recipient.accountNumber) && styles.buttonDisabled]}
        onPress={onVerify}
        disabled={!recipient.bankCode || !recipient.accountNumber}
      >
        <Text style={styles.verifyButtonText}>Verify Account</Text>
      </TouchableOpacity>

      {/* Bank Selection Modal */}
      <Modal visible={showBankModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Bank</Text>
            <TouchableOpacity onPress={() => setShowBankModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {banks.map(bank => (
              <TouchableOpacity
                key={bank.code}
                style={styles.bankItem}
                onPress={() => handleBankSelection(bank)}
              >
                <Text style={styles.bankName}>{bank.name}</Text>
                <Text style={styles.bankCode}>{bank.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

// Token Selection Modal Component
const TokenSelectionModal = ({ 
  visible, 
  tokens, 
  onSelect, 
  onClose 
}: {
  visible: boolean;
  tokens: TokenBalance[];
  onSelect: (token: TokenBalance) => void;
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Token</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {tokens.map((token, index) => (
            <TouchableOpacity
              key={index}
              style={styles.tokenItem}
              onPress={() => onSelect(token)}
            >
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenName}>{token.name}</Text>
              </View>
              <View style={styles.tokenBalanceContainer}>
                <Text style={styles.tokenBalanceAmount}>{parseFloat(token.balance).toFixed(4)}</Text>
                <Text style={styles.tokenBalanceUSD}>${parseFloat(token.balanceUSD).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

// Batch Transaction Progress Modal Component
const BatchTransactionProgressModal = ({ 
  visible, 
  status, 
  batchId, 
  progress,
  onClose 
}: {
  visible: boolean;
  status: string;
  batchId: string;
  progress: { completedRecipients: number; totalRecipients: number; currentRecipient?: string };
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.progressModalOverlay}>
        <View style={styles.progressModalContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.progressStatus}>{status}</Text>
          {batchId && (
            <Text style={styles.transactionHash}>
              Batch ID: {batchId.substring(0, 10)}...
            </Text>
          )}
          <View style={styles.progressBar}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${(progress.completedRecipients / progress.totalRecipients) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {progress.completedRecipients}/{progress.totalRecipients} recipients processed
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCompleted: {
    backgroundColor: colors.success,
  },
  stepActive: {
    backgroundColor: colors.primary,
  },
  stepError: {
    backgroundColor: colors.error,
  },
  stepNumber: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.cardBackground,
    marginLeft: 8,
  },
  stepLineCompleted: {
    backgroundColor: colors.success,
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  recipientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recipientsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  recipientsList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  recipientCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recipientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipientNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  removeButton: {
    padding: 4,
  },
  selector: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selectorValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  verificationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.success,
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenInfo: {
    flex: 1,
  },
  tokenBalance: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  batchSummary: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  memoInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 16,
    color: colors.success,
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  bankName: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  bankCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tokenName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tokenBalanceContainer: {
    alignItems: 'flex-end',
  },
  tokenBalanceAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  tokenBalanceUSD: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  progressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressModalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 40,
  },
  progressStatus: {
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  transactionHash: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  progressBar: {
    width: '100%',
    marginTop: 16,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});