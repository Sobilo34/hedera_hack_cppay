/**
 * Scheduled Payment Screen
 * 
 * Allows users to schedule crypto-to-naira payments for future execution.
 * Supports one-time and recurring payments with Account Abstraction.
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
// Using React Native's built-in date picker components
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

// Services
import PaystackService, { NigerianBank } from '@/services/PaystackService';
import TokenBalanceService from '@/services/TokenBalanceService';
import PriceService from '@/services/PriceService';
import SecureWalletStorage from '@/services/SecureWalletStorage';
import ScheduledPaymentService, { ScheduledPaymentRequest } from '@/services/ScheduledPaymentService';

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

export default function ScheduledPaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
  const [transactionSteps, setTransactionSteps] = useState<TransactionStep[]>([
    { id: 1, title: 'Recipient', description: 'Select bank and verify account', completed: false, active: true },
    { id: 2, title: 'Token Selection', description: 'Choose crypto to convert', completed: false, active: false },
    { id: 3, title: 'Schedule', description: 'Set date and recurring options', completed: false, active: false },
    { id: 4, title: 'Review', description: 'Review and calculate', completed: false, active: false },
    { id: 5, title: 'Schedule', description: 'Schedule payment', completed: false, active: false },
  ]);

  // Form state
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [nairaAmount, setNairaAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [memo, setMemo] = useState('');

  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState(new Date());
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Date picker state
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());

  // Transaction calculation
  const [exchangeRate, setExchangeRate] = useState(0);
  const [cryptoAmount, setCryptoAmount] = useState(0);
  const [gasEstimate, setGasEstimate] = useState(0);
  const [totalCryptoNeeded, setTotalCryptoNeeded] = useState(0);
  const [transactionFee, setTransactionFee] = useState(0);

  // Modal states
  const [showBankModal, setShowBankModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Transaction processing
  const [scheduledId, setScheduledId] = useState<string>('');
  const [transactionStatus, setTransactionStatus] = useState<string>('');

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

  // Step 1: Bank Account Verification
  const handleBankSelection = (bank: NigerianBank) => {
    setSelectedBank(bank);
    setShowBankModal(false);
    setAccountName('');
  };

  const verifyBankAccount = async () => {
    if (!selectedBank || !accountNumber) {
      Alert.alert('Error', 'Please select a bank and enter account number');
      return;
    }

    if (accountNumber.length !== 10) {
      Alert.alert('Error', 'Account number must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      const verification = await PaystackService.verifyBankAccount(
        accountNumber,
        selectedBank.code
      );
      
      setAccountName(verification.account_name);
      updateStepStatus(1, true, false);
      setCurrentStep(2);
      
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

  // Step 2: Token Selection
  const handleTokenSelection = (token: TokenBalance) => {
    setSelectedToken(token);
    setShowTokenModal(false);
    updateStepStatus(2, true, false);
    setCurrentStep(3);
  };

  // Step 3: Schedule Configuration
  const handleDatePickerOpen = () => {
    setTempDate(scheduledDate);
    setTempTime(scheduledDate);
    setShowDatePicker(true);
  };

  const handleDatePickerConfirm = () => {
    // Combine date and time
    const combinedDate = new Date(
      tempDate.getFullYear(),
      tempDate.getMonth(),
      tempDate.getDate(),
      tempTime.getHours(),
      tempTime.getMinutes(),
      tempTime.getSeconds()
    );
    setScheduledDate(combinedDate);
    setShowDatePicker(false);
  };

  const handleEndDatePickerOpen = () => {
    setTempEndDate(recurringEndDate);
    setShowEndDatePicker(true);
  };

  const handleEndDatePickerConfirm = () => {
    setRecurringEndDate(tempEndDate);
    setShowEndDatePicker(false);
  };

  const validateSchedule = (): boolean => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 60000); // At least 1 minute in the future

    if (scheduledDate < minDate) {
      Alert.alert('Error', 'Scheduled date must be at least 1 minute in the future');
      return false;
    }

    if (isRecurring && recurringEndDate <= scheduledDate) {
      Alert.alert('Error', 'Recurring end date must be after scheduled date');
      return false;
    }

    return true;
  };

  // Step 4: Calculate Transaction
  const calculateTransaction = useCallback(async () => {
    if (!selectedToken || !nairaAmount || parseFloat(nairaAmount) <= 0) {
      return;
    }

    try {
      setLoading(true);
      
      // Get current exchange rate
      const tokenPrice = await PriceService.getTokenPrice(selectedToken.symbol, 'ngn');
      const rate = parseFloat(tokenPrice.price);
      setExchangeRate(rate);
      
      // Calculate crypto amount needed
      const nairaAmountNum = parseFloat(nairaAmount);
      const cryptoNeeded = nairaAmountNum / rate;
      setCryptoAmount(cryptoNeeded);
      
      // Estimate gas fees
      const gasEstimateWei = await estimateGasFee();
      setGasEstimate(gasEstimateWei);
      
      // Calculate total crypto needed (including gas)
      const total = cryptoNeeded + gasEstimateWei;
      setTotalCryptoNeeded(total);
      
      // Get Paystack transfer fee
      const feeInfo = await PaystackService.getTransferFees(nairaAmountNum);
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
      console.error('Failed to calculate transaction:', error);
      Alert.alert('Error', 'Failed to calculate transaction: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedToken, nairaAmount]);

  useEffect(() => {
    if (currentStep === 4) {
      calculateTransaction();
    }
  }, [currentStep, calculateTransaction]);

  const estimateGasFee = async (): Promise<number> => {
    return 0.01; // 0.01 ETH equivalent
  };

  // Step 5: Schedule Payment
  const schedulePayment = async () => {
    if (!selectedToken || !selectedBank || !accountName || !nairaAmount) {
      Alert.alert('Error', 'Missing required transaction data');
      return;
    }

    if (!validateSchedule()) {
      return;
    }

    const request: ScheduledPaymentRequest = {
      recipient: {
        bankCode: selectedBank.code,
        accountNumber,
        accountName,
        nairaAmount: parseFloat(nairaAmount),
        memo,
      },
      selectedToken: {
        symbol: selectedToken.symbol,
        address: selectedToken.address,
        decimals: selectedToken.decimals,
      },
      nairaAmount: parseFloat(nairaAmount),
      scheduledDate,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      recurringEndDate: isRecurring ? recurringEndDate : undefined,
      memo,
    };

    setShowTransactionModal(true);
    updateStepStatus(5, false, true);
    
    try {
      const scheduledService = new ScheduledPaymentService(4202); // Lisk Sepolia testnet
      
      setTransactionStatus('Scheduling payment...');
      
      // Schedule crypto-to-naira transaction
      const result = await scheduledService.schedulePayment(request);
      
      setScheduledId(result.scheduledId);
      setTransactionStatus('Payment scheduled successfully ✅');
      
      updateStepStatus(5, true, false);
      
      Alert.alert(
        'Payment Scheduled ✅',
        `Your payment has been scheduled for ${scheduledDate.toLocaleString()}${
          isRecurring ? ` (${recurringInterval})` : ''
        }`,
        [{ text: 'OK' }]
      );
      
    } catch (error: any) {
      console.error('Scheduling failed:', error);
      updateStepStatus(5, false, false, error.message);
      setTransactionStatus(`Failed: ${error.message}`);
      Alert.alert('Scheduling Failed', error.message);
    }
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

  const renderRecipientStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Bank & Verify Account</Text>
      
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowBankModal(true)}
      >
        <Text style={styles.selectorLabel}>Bank</Text>
        <Text style={styles.selectorValue}>
          {selectedBank ? selectedBank.name : 'Select Bank'}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Account Number (10 digits)"
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType="numeric"
        maxLength={10}
        placeholderTextColor={colors.textSecondary}
      />

      {accountName && (
        <View style={styles.verificationResult}>
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
          <Text style={styles.verificationText}>{accountName}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, (!selectedBank || !accountNumber) && styles.buttonDisabled]}
        onPress={verifyBankAccount}
        disabled={loading || !selectedBank || !accountNumber}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Verify Account</Text>
        )}
      </TouchableOpacity>
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

  const renderScheduleStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Schedule Payment</Text>
      
      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Amount to Send (₦)</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          value={nairaAmount}
          onChangeText={setNairaAmount}
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.scheduleContainer}>
        <Text style={styles.scheduleLabel}>Schedule Date & Time</Text>
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={handleDatePickerOpen}
        >
          <MaterialCommunityIcons name="calendar" size={24} color={colors.primary} />
          <Text style={styles.dateText}>
            {scheduledDate.toLocaleString()}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.recurringContainer}>
        <TouchableOpacity
          style={styles.recurringToggle}
          onPress={() => setIsRecurring(!isRecurring)}
        >
          <MaterialCommunityIcons 
            name={isRecurring ? "checkbox-marked" : "checkbox-blank-outline"} 
            size={24} 
            color={isRecurring ? colors.primary : colors.textSecondary} 
          />
          <Text style={styles.recurringLabel}>Make this a recurring payment</Text>
        </TouchableOpacity>

        {isRecurring && (
          <View style={styles.recurringOptions}>
            <Text style={styles.recurringOptionsLabel}>Repeat every:</Text>
            <View style={styles.intervalButtons}>
              {(['daily', 'weekly', 'monthly'] as const).map((interval) => (
                <TouchableOpacity
                  key={interval}
                  style={[
                    styles.intervalButton,
                    recurringInterval === interval && styles.intervalButtonActive
                  ]}
                  onPress={() => setRecurringInterval(interval)}
                >
                  <Text style={[
                    styles.intervalButtonText,
                    recurringInterval === interval && styles.intervalButtonTextActive
                  ]}>
                    {interval.charAt(0).toUpperCase() + interval.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.recurringOptionsLabel}>End date:</Text>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={handleEndDatePickerOpen}
            >
              <MaterialCommunityIcons name="calendar" size={24} color={colors.primary} />
              <Text style={styles.dateText}>
                {recurringEndDate.toLocaleDateString()}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, (!nairaAmount || parseFloat(nairaAmount) <= 0) && styles.buttonDisabled]}
        onPress={() => {
          if (validateSchedule()) {
            updateStepStatus(3, true, false);
            setCurrentStep(4);
          }
        }}
        disabled={!nairaAmount || parseFloat(nairaAmount) <= 0}
      >
        <Text style={styles.buttonText}>Continue to Review</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Scheduled Payment</Text>
      
      <View style={styles.calculationCard}>
        <Text style={styles.calculationTitle}>Payment Summary</Text>
        
        <View style={styles.calculationRow}>
          <Text style={styles.calculationLabel}>Recipient:</Text>
          <Text style={styles.calculationValue}>{accountName}</Text>
        </View>
        
        <View style={styles.calculationRow}>
          <Text style={styles.calculationLabel}>Amount:</Text>
          <Text style={styles.calculationValue}>₦{parseFloat(nairaAmount).toLocaleString()}</Text>
        </View>
        
        <View style={styles.calculationRow}>
          <Text style={styles.calculationLabel}>Scheduled for:</Text>
          <Text style={styles.calculationValue}>{scheduledDate.toLocaleString()}</Text>
        </View>
        
        {isRecurring && (
          <View style={styles.calculationRow}>
            <Text style={styles.calculationLabel}>Recurring:</Text>
            <Text style={styles.calculationValue}>
              {recurringInterval} until {recurringEndDate.toLocaleDateString()}
            </Text>
          </View>
        )}
        
        {exchangeRate > 0 && (
          <>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Exchange Rate:</Text>
              <Text style={styles.calculationValue}>
                1 {selectedToken?.symbol} = ₦{exchangeRate.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Crypto Needed:</Text>
              <Text style={styles.calculationValue}>
                {cryptoAmount.toFixed(6)} {selectedToken?.symbol}
              </Text>
            </View>
            
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Gas Fee:</Text>
              <Text style={styles.calculationValue}>
                {gasEstimate.toFixed(6)} {selectedToken?.symbol}
              </Text>
            </View>
            
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Paystack Fee:</Text>
              <Text style={styles.calculationValue}>₦{transactionFee}</Text>
            </View>
            
            <View style={[styles.calculationRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Crypto Required:</Text>
              <Text style={styles.totalValue}>
                {totalCryptoNeeded.toFixed(6)} {selectedToken?.symbol}
              </Text>
            </View>
          </>
        )}
      </View>

      <TextInput
        style={styles.memoInput}
        placeholder="Memo (optional)"
        value={memo}
        onChangeText={setMemo}
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[styles.button, totalCryptoNeeded <= 0 && styles.buttonDisabled]}
        onPress={() => {
          updateStepStatus(4, true, false);
          setCurrentStep(5);
        }}
        disabled={totalCryptoNeeded <= 0}
      >
        <Text style={styles.buttonText}>Schedule Payment</Text>
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
          <Text style={styles.headerTitle}>Scheduled Payment</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {currentStep === 1 && renderRecipientStep()}
          {currentStep === 2 && renderTokenSelectionStep()}
          {currentStep === 3 && renderScheduleStep()}
          {currentStep === 4 && renderReviewStep()}
          {currentStep === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Schedule Payment</Text>
              <TouchableOpacity style={styles.button} onPress={schedulePayment}>
                <Text style={styles.buttonText}>Confirm & Schedule</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        <BankSelectionModal
          visible={showBankModal}
          banks={banks}
          onSelect={handleBankSelection}
          onClose={() => setShowBankModal(false)}
        />

        <TokenSelectionModal
          visible={showTokenModal}
          tokens={userTokens}
          onSelect={handleTokenSelection}
          onClose={() => setShowTokenModal(false)}
        />

        <ScheduledTransactionProgressModal
          visible={showTransactionModal}
          status={transactionStatus}
          scheduledId={scheduledId}
          onClose={() => setShowTransactionModal(false)}
        />

        {/* Date Pickers */}
        {showDatePicker && (
          <Modal visible={showDatePicker} animationType="slide" transparent>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerTitle}>Select Date & Time</Text>
                <View style={styles.datePickerContent}>
                  <Text style={styles.datePickerLabel}>Date:</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => {
                      // For now, we'll use a simple increment/decrement approach
                      // In a real app, you'd use a proper date picker library
                    }}
                  >
                    <Text style={styles.dateInputText}>
                      {tempDate.toLocaleDateString()}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  <View style={styles.dateControls}>
                    <TouchableOpacity
                      style={styles.dateControlButton}
                      onPress={() => {
                        const newDate = new Date(tempDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setTempDate(newDate);
                      }}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.dateControlText}>Previous Day</Text>
                    <Text style={styles.dateControlText}>Next Day</Text>
                    <TouchableOpacity
                      style={styles.dateControlButton}
                      onPress={() => {
                        const newDate = new Date(tempDate);
                        newDate.setDate(newDate.getDate() + 1);
                        setTempDate(newDate);
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.datePickerLabel}>Time:</Text>
                  <TouchableOpacity
                    style={styles.timeInput}
                    onPress={() => {
                      // Time picker functionality
                    }}
                  >
                    <Text style={styles.dateInputText}>
                      {tempTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <MaterialCommunityIcons name="clock" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  <View style={styles.timeControls}>
                    <View style={styles.timeControlGroup}>
                      <Text style={styles.timeControlLabel}>Hour:</Text>
                      <View style={styles.timeControlButtons}>
                        <TouchableOpacity
                          style={styles.timeControlButton}
                          onPress={() => {
                            const newTime = new Date(tempTime);
                            newTime.setHours(newTime.getHours() - 1);
                            setTempTime(newTime);
                          }}
                        >
                          <MaterialCommunityIcons name="minus" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.timeControlValue}>{tempTime.getHours()}</Text>
                        <TouchableOpacity
                          style={styles.timeControlButton}
                          onPress={() => {
                            const newTime = new Date(tempTime);
                            newTime.setHours(newTime.getHours() + 1);
                            setTempTime(newTime);
                          }}
                        >
                          <MaterialCommunityIcons name="plus" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.timeControlGroup}>
                      <Text style={styles.timeControlLabel}>Minute:</Text>
                      <View style={styles.timeControlButtons}>
                        <TouchableOpacity
                          style={styles.timeControlButton}
                          onPress={() => {
                            const newTime = new Date(tempTime);
                            newTime.setMinutes(newTime.getMinutes() - 15);
                            setTempTime(newTime);
                          }}
                        >
                          <MaterialCommunityIcons name="minus" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.timeControlValue}>{tempTime.getMinutes()}</Text>
                        <TouchableOpacity
                          style={styles.timeControlButton}
                          onPress={() => {
                            const newTime = new Date(tempTime);
                            newTime.setMinutes(newTime.getMinutes() + 15);
                            setTempTime(newTime);
                          }}
                        >
                          <MaterialCommunityIcons name="plus" size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                    onPress={handleDatePickerConfirm}
                  >
                    <Text style={styles.datePickerButtonTextPrimary}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {showEndDatePicker && (
          <Modal visible={showEndDatePicker} animationType="slide" transparent>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerTitle}>Select End Date</Text>
                <View style={styles.datePickerContent}>
                  <Text style={styles.datePickerLabel}>End Date:</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => {
                      // Date picker functionality
                    }}
                  >
                    <Text style={styles.dateInputText}>
                      {tempEndDate.toLocaleDateString()}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  <View style={styles.dateControls}>
                    <TouchableOpacity
                      style={styles.dateControlButton}
                      onPress={() => {
                        const newDate = new Date(tempEndDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setTempEndDate(newDate);
                      }}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.dateControlText}>Previous Day</Text>
                    <Text style={styles.dateControlText}>Next Day</Text>
                    <TouchableOpacity
                      style={styles.dateControlButton}
                      onPress={() => {
                        const newDate = new Date(tempEndDate);
                        newDate.setDate(newDate.getDate() + 1);
                        setTempEndDate(newDate);
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowEndDatePicker(false)}
                  >
                    <Text style={styles.datePickerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                    onPress={handleEndDatePickerConfirm}
                  >
                    <Text style={styles.datePickerButtonTextPrimary}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Bank Selection Modal Component
const BankSelectionModal = ({ 
  visible, 
  banks, 
  onSelect, 
  onClose 
}: {
  visible: boolean;
  banks: NigerianBank[];
  onSelect: (bank: NigerianBank) => void;
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Bank</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {banks.map(bank => (
            <TouchableOpacity
              key={bank.code}
              style={styles.bankItem}
              onPress={() => onSelect(bank)}
            >
              <Text style={styles.bankName}>{bank.name}</Text>
              <Text style={styles.bankCode}>{bank.code}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
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

// Scheduled Transaction Progress Modal Component
const ScheduledTransactionProgressModal = ({ 
  visible, 
  status, 
  scheduledId, 
  onClose 
}: {
  visible: boolean;
  status: string;
  scheduledId: string;
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
          {scheduledId && (
            <Text style={styles.transactionHash}>
              Scheduled ID: {scheduledId.substring(0, 10)}...
            </Text>
          )}
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
  selector: {
    backgroundColor: colors.cardBackground,
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
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  verificationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
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
  amountContainer: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  scheduleContainer: {
    marginBottom: 20,
  },
  scheduleLabel: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  dateSelector: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  recurringContainer: {
    marginBottom: 20,
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recurringLabel: {
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  recurringOptions: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  recurringOptionsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  intervalButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  intervalButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  intervalButtonActive: {
    backgroundColor: colors.primary,
  },
  intervalButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: 'white',
  },
  calculationCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  calculationValue: {
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
  // Date picker styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 40,
    width: '80%',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  datePickerContent: {
    marginBottom: 20,
  },
  datePickerLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  timeInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  datePickerButtonPrimary: {
    backgroundColor: colors.primary,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  datePickerButtonTextPrimary: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  // Additional date picker styles
  dateInputText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateControlButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateControlText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  timeControls: {
    marginTop: 16,
  },
  timeControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeControlLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  timeControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeControlButton: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  timeControlValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
});