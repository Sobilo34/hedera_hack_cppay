/**
 * Crypto to Naira Flow Screen
 * 
 * Complete end-to-end crypto-to-naira transaction flow:
 * 1. Bank account selection and verification
 * 2. Token selection from user's portfolio  
 * 3. Amount input and conversion calculation
 * 4. User operation creation and signing
 * 5. Smart contract interaction via BillPaymentAdapter
 * 6. Transaction monitoring and completion
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
import PaystackService, { NigerianBank, AccountVerificationResult } from '@/services/PaystackService';
import TokenBalanceService from '@/services/TokenBalanceService';
import SmartAccountService from '@/services/SmartAccountService';
import PriceService from '@/services/PriceService';
import SecureWalletStorage from '@/services/SecureWalletStorage';
import EnhancedUserOpService from '@/services/EnhancedUserOpService';
import MockTreasuryService from '@/services/MockTreasuryService';
import { useWalletStore } from '@/store/walletStore';

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

interface CryptoToNairaRequest {
  selectedBank: NigerianBank;
  accountNumber: string;
  accountName: string;
  selectedToken: TokenBalance;
  nairaAmount: number;
  cryptoAmount: number;
  exchangeRate: number;
  gasEstimate: number;
  totalCryptoNeeded: number;
  memo?: string;
}

export default function CryptoToNairaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
  const [transactionSteps, setTransactionSteps] = useState<TransactionStep[]>([
    { id: 1, title: 'Bank Details', description: 'Select bank and verify account', completed: false, active: true },
    { id: 2, title: 'Token Selection', description: 'Choose crypto to convert', completed: false, active: false },
    { id: 3, title: 'Amount & Review', description: 'Enter amount and review', completed: false, active: false },
    { id: 4, title: 'Transaction', description: 'Sign and submit transaction', completed: false, active: false },
    { id: 5, title: 'Completion', description: 'Transaction processing', completed: false, active: false },
  ]);

  // Form state
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedAccount, setVerifiedAccount] = useState<AccountVerificationResult | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [nairaAmount, setNairaAmount] = useState('');
  const [memo, setMemo] = useState('');

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
  const [transactionHash, setTransactionHash] = useState<string>('');
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
    setVerifiedAccount(null);
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
      
      setVerifiedAccount(verification);
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

  // Step 3: Amount Calculation
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
      const gasInToken = gasEstimateWei; // Simplified - normally would convert based on token
      setGasEstimate(gasInToken);
      
      // Calculate total crypto needed (including gas)
      const total = cryptoNeeded + gasInToken;
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
    if (currentStep === 3) {
      calculateTransaction();
    }
  }, [currentStep, calculateTransaction]);

  const estimateGasFee = async (): Promise<number> => {
    // This would normally call the smart contract to estimate gas
    // For now, return a reasonable estimate
    return 0.01; // 0.01 ETH equivalent
  };

  // Step 4: Transaction Execution
  const executeTransaction = async () => {
    if (!selectedToken || !selectedBank || !verifiedAccount || !nairaAmount) {
      Alert.alert('Error', 'Missing required transaction data');
      return;
    }

    const request: CryptoToNairaRequest = {
      selectedBank,
      accountNumber,
      accountName: verifiedAccount.account_name,
      selectedToken,
      nairaAmount: parseFloat(nairaAmount),
      cryptoAmount,
      exchangeRate,
      gasEstimate,
      totalCryptoNeeded,
      memo,
    };

    setShowTransactionModal(true);
    updateStepStatus(4, false, true);
    
    try {
      // Initialize enhanced user operation service
      const userOpService = new EnhancedUserOpService(4202); // Lisk Sepolia testnet
      
      setTransactionStatus('Preparing transaction...');
      
      // Execute crypto-to-naira transaction
      const result = await userOpService.executeCryptoToNairaTransaction(
        parseFloat(nairaAmount),
        {
          bankCode: selectedBank.code,
          accountNumber,
          accountName: verifiedAccount.account_name,
        },
        {
          token: selectedToken.symbol,
          amount: cryptoAmount,
        },
        memo,
        true // Use paymaster for gas sponsorship
      );
      
      setTransactionHash(result.userOperationHash);
      setTransactionStatus('Transaction submitted ✅');
      
      // Register transaction with mock treasury
      const treasuryTx = await MockTreasuryService.registerCryptoToNairaTransaction(
        result.userOperationHash,
        selectedToken.symbol,
        cryptoAmount,
        await SecureWalletStorage.getAddress() || '',
        parseFloat(nairaAmount),
        {
          bankCode: selectedBank.code,
          accountNumber,
          accountName: verifiedAccount.account_name,
        },
        memo
      );
      
      console.log('📋 Treasury transaction registered:', treasuryTx.id);
      
      // Monitor transaction progress
      await monitorTransactionProgress(result.userOperationHash, treasuryTx.id);
      
      updateStepStatus(4, true, false);
      setCurrentStep(5);
      
    } catch (error: any) {
      console.error('Transaction failed:', error);
      updateStepStatus(4, false, false, error.message);
      setTransactionStatus(`Failed: ${error.message}`);
      Alert.alert('Transaction Failed', error.message);
    }
  };

  const createCryptoToNairaUserOperation = async (
    request: CryptoToNairaRequest,
    smartAccountAddress: string
  ) => {
    // This would create the actual user operation to interact with BillPaymentAdapter
    // For now, return a mock structure
    const providerCode = Buffer.from('PAYSTACK_NGN', 'utf8');
    const refId = PaystackService.generateReference('CTN');
    
    const paymentRequest = {
      providerCode: providerCode,
      account: smartAccountAddress,
      amount: BigInt(Math.round(request.nairaAmount * 100)), // Convert to kobo
      refId: Buffer.from(refId, 'utf8'),
      metadata: Buffer.from(JSON.stringify({
        bankCode: request.selectedBank.code,
        accountNumber: request.accountNumber,
        accountName: request.accountName,
        cryptoToken: request.selectedToken.symbol,
        cryptoAmount: request.cryptoAmount,
        memo: request.memo,
      }), 'utf8'),
    };
    
    // Return mock user operation
    return {
      sender: smartAccountAddress,
      nonce: '0x0',
      initCode: '0x',
      callData: '0x', // This would be the actual call to BillPaymentAdapter.submitPayment
      callGasLimit: '0x5208',
      verificationGasLimit: '0x5208',
      preVerificationGas: '0x5208',
      maxFeePerGas: '0x3b9aca00',
      maxPriorityFeePerGas: '0x3b9aca00',
      paymasterAndData: '0x',
      signature: '0x',
    };
  };

  const monitorTransactionProgress = async (
    userOperationHash: string,
    treasuryTransactionId: string
  ) => {
    setTransactionStatus('Monitoring blockchain confirmation...');
    
    // Poll treasury service for transaction updates
    const maxWaitTime = 60000; // 1 minute (reduced from 5 minutes)
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second (reduced from 5 seconds)
    
    while (Date.now() - startTime < maxWaitTime) {
      const treasuryTx = MockTreasuryService.getTransaction(treasuryTransactionId);
      
      if (!treasuryTx) {
        throw new Error('Transaction not found in treasury');
      }
      
      // Update UI based on treasury transaction status
      switch (treasuryTx.status) {
        case 'pending':
          setTransactionStatus('Waiting for crypto confirmation...');
          break;
        case 'crypto_received':
          setTransactionStatus('Crypto received ✅ Converting to naira...');
          break;
        case 'fiat_processing':
          setTransactionStatus('Processing naira payment...');
          break;
        case 'fiat_sent':
          setTransactionStatus('Naira sent to bank account ✅');
          break;
        case 'completed':
          setTransactionStatus('Transaction completed successfully 🎉');
          updateStepStatus(5, true, false);
          setShowTransactionModal(false); // Close modal when complete
          
          // Update transaction history and balances
          await updateTransactionHistoryAndBalances(userOperationHash, treasuryTransactionId);
          
          return; // Transaction complete
        case 'failed':
          throw new Error(treasuryTx.error || 'Transaction failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Transaction monitoring timeout');
  };

  // Update transaction history and balances after successful transaction
  const updateTransactionHistoryAndBalances = async (
    userOperationHash: string,
    treasuryTransactionId: string
  ) => {
    try {
      console.log('📝 Updating transaction history and balances...');
      
      // Get treasury transaction details
      const treasuryTx = MockTreasuryService.getTransaction(treasuryTransactionId);
      if (!treasuryTx) {
        console.error('Treasury transaction not found');
        return;
      }
      
      // Get wallet store instance
      const walletStore = useWalletStore.getState();
      
      // Create transaction record
      const transaction = {
        id: `crypto_to_naira_${userOperationHash}`,
        type: 'crypto_to_naira' as const,
        status: 'completed' as const,
        from: walletStore.wallet.address || '',
        to: `${selectedBank.code}:${accountNumber}`,
        amount: parseFloat(nairaAmount),
        currency: 'NGN',
        token: selectedToken.symbol,
        tokenAmount: cryptoAmount,
        timestamp: Date.now(),
        hash: userOperationHash,
        memo: memo || `Crypto to Naira: ${selectedToken.symbol} → ₦${nairaAmount}`,
        network: 'ethereum',
        gasUsed: gasEstimate,
        gasPrice: 0,
        fees: {
          network: gasEstimate,
          platform: treasuryTx.fees.paystackFee,
          total: gasEstimate + treasuryTx.fees.paystackFee,
        },
        recipient: {
          bankCode: selectedBank.code,
          accountNumber: accountNumber,
          accountName: verifiedAccount?.account_name || accountName,
        },
        exchangeRate: exchangeRate,
      };

      // Add transaction to the store
      walletStore.addTransaction(transaction);

      // Update token balances
      await updateTokenBalances(selectedToken.symbol, totalCryptoNeeded);
      
      console.log('✅ Added crypto-to-naira transaction to history');
    } catch (error) {
      console.error('❌ Failed to update transaction history:', error);
      // Don't throw error as this is not critical for the main flow
    }
  };

  /**
   * Update token balances after transaction
   */
  const updateTokenBalances = async (tokenSymbol: string, amountUsed: number) => {
    try {
      console.log(`💰 Updating ${tokenSymbol} balance: -${amountUsed}`);
      
      // Get current balances
      const walletStore = useWalletStore.getState();
      const currentBalances = await TokenBalanceService.getTokenBalances(
        walletStore.wallet.address || '',
        1 // Ethereum mainnet
      );
      
      // Find the token and update its balance
      const updatedBalances = currentBalances.map(balance => {
        if (balance.token.symbol === tokenSymbol) {
          return {
            ...balance,
            balance: Math.max(0, balance.balance - amountUsed), // Ensure balance doesn't go negative
            lastUpdated: Date.now(),
          };
        }
        return balance;
      });
      
      // Update the store with new balances
      walletStore.set((state) => ({
        balances: {
          ...state.balances,
          tokens: updatedBalances,
          lastUpdated: Date.now(),
        },
      }));
      
      // Recalculate total balances
      walletStore.calculateTotalBalance();
      
      console.log(`✅ Updated ${tokenSymbol} balance`);
    } catch (error) {
      console.error('❌ Failed to update token balances:', error);
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

  const renderBankSelectionStep = () => (
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

      {verifiedAccount && (
        <View style={styles.verificationResult}>
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
          <Text style={styles.verificationText}>{verifiedAccount.account_name}</Text>
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

  // Continue with more render methods...
  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Enter Amount & Review</Text>
      
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

      {exchangeRate > 0 && (
        <View style={styles.calculationCard}>
          <Text style={styles.calculationTitle}>Transaction Summary</Text>
          
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
        </View>
      )}

      <TextInput
        style={styles.memoInput}
        placeholder="Memo (optional)"
        value={memo}
        onChangeText={setMemo}
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[styles.button, (!nairaAmount || parseFloat(nairaAmount) <= 0) && styles.buttonDisabled]}
        onPress={() => {
          updateStepStatus(3, true, false);
          setCurrentStep(4);
        }}
        disabled={!nairaAmount || parseFloat(nairaAmount) <= 0 || totalCryptoNeeded <= 0}
      >
        <Text style={styles.buttonText}>Proceed to Transaction</Text>
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
          <Text style={styles.headerTitle}>Crypto to Naira</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {currentStep === 1 && renderBankSelectionStep()}
          {currentStep === 2 && renderTokenSelectionStep()}
          {currentStep === 3 && renderAmountStep()}
          {currentStep === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Execute Transaction</Text>
              <TouchableOpacity style={styles.button} onPress={executeTransaction}>
                <Text style={styles.buttonText}>Sign & Send Transaction</Text>
              </TouchableOpacity>
            </View>
          )}
          {currentStep === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Transaction Complete</Text>
              <Text style={styles.successMessage}>
                Your crypto has been converted and naira sent to the bank account!
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

        <TransactionProgressModal
          visible={showTransactionModal}
          status={transactionStatus}
          transactionHash={transactionHash}
          onClose={() => setShowTransactionModal(false)}
        />
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

// Transaction Progress Modal Component
const TransactionProgressModal = ({ 
  visible, 
  status, 
  transactionHash, 
  onClose 
}: {
  visible: boolean;
  status: string;
  transactionHash: string;
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
          {transactionHash && (
            <Text style={styles.transactionHash}>
              Hash: {transactionHash.substring(0, 10)}...
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
});