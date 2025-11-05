/**
 * Crypto-to-Naira Transaction Flow
 * 
 * Master component that orchestrates the complete transaction flow:
 * 1. Amount Input
 * 2. Bank Recipient
 * 3. Transaction Review
 * 4. Signature & Execution
 * 5. Status Tracking
 * 6. Completion/Error
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import AmountInputScreen from './AmountInputScreen';
import BankRecipientScreen from './BankRecipientScreen';
import TransactionReviewScreen from './TransactionReviewScreen';
import TransactionStatusScreen from './TransactionStatusScreen';
// import CryptoToNairaService from '../services/CryptoToNairaService';

type TransactionStep =
  | 'amount'
  | 'bank'
  | 'review'
  | 'execute'
  | 'status'
  | 'complete'
  | 'error';

interface CryptoToNairaFlow {
  chainId: number;
  userPrivateKey: string;
  onClose: () => void;
}

const CryptoToNairaTransactionFlow: React.FC<CryptoToNairaFlow> = ({
  chainId,
  userPrivateKey,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<TransactionStep>('amount');
  const [transactionData, setTransactionData] = useState<any>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Placeholder for transaction service - would use CryptoToNairaService in real impl
  // const transactionService = new CryptoToNairaService(chainId);

  /**
   * Handle amount input step
   */
  const handleAmountNext = (data: {
    nairaAmount: number;
    cryptoToken: string;
    cryptoAmount: number;
    gasFee: number;
    exchangeRate: number;
  }) => {
    setTransactionData((prev: any) => ({ ...prev, ...data }));
    setCurrentStep('bank');
  };

  /**
   * Handle bank recipient step
   */
  const handleBankNext = (data: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => {
    setTransactionData((prev: any) => ({ ...prev, ...data }));
    setCurrentStep('review');
  };

  /**
   * Handle transaction review confirmation
   */
  const handleReviewConfirm = async () => {
    try {
      setCurrentStep('execute');

      // Initialize transaction
      // const initResult = await transactionService.initiateTransaction({
      const initResult = {
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      setTransactionId(initResult.transactionId);

      // Sign and execute swap
      // const swapResult = await transactionService.signAndExecuteSwap(
      const swapResult = {
        userOperationHash: `0x${Math.random().toString(16).substr(2)}`,
      };

      // Monitor swap confirmation and settlement
      // await transactionService.waitForSwapConfirmation(

      // Move to status tracking
      setCurrentStep('status');
    } catch (err) {
      console.error('Transaction execution failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setCurrentStep('error');
    }
  };

  /**
   * Handle transaction completion
   */
  const handleTransactionComplete = () => {
    setCurrentStep('complete');
    Alert.alert('Success', 'Your transaction has been completed successfully!', [
      {
        text: 'Done',
        onPress: onClose,
      },
    ]);
  };

  /**
   * Handle transaction error
   */
  const handleTransactionError = (errorMsg: string) => {
    setError(errorMsg);
    setCurrentStep('error');
  };

  /**
   * Go back to previous step
   */
  const goBack = () => {
    const stepSequence: TransactionStep[] = [
      'amount',
      'bank',
      'review',
      'execute',
      'status',
    ];
    const currentIndex = stepSequence.indexOf(currentStep);

    if (currentIndex > 0) {
      setCurrentStep(stepSequence[currentIndex - 1]);
    } else {
      // Close if at beginning
      onClose();
    }
  };

  /**
   * Close transaction flow
   */
  const handleCancel = () => {
    Alert.alert('Cancel Transaction', 'Are you sure you want to cancel this transaction?', [
      { text: 'No', onPress: () => {} },
      {
        text: 'Yes, Cancel',
        onPress: onClose,
        style: 'destructive',
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {currentStep === 'amount' && (
        <AmountInputScreen
          chainId={chainId}
          onNext={handleAmountNext}
          onCancel={handleCancel}
        />
      )}

      {currentStep === 'bank' && (
        <BankRecipientScreen
          onNext={handleBankNext}
          onBack={goBack}
        />
      )}

      {currentStep === 'review' && transactionData && (
        <TransactionReviewScreen
          data={transactionData}
          onConfirm={handleReviewConfirm}
          onBack={goBack}
        />
      )}

      {currentStep === 'status' && transactionId && (
        <TransactionStatusScreen
          transactionId={transactionId}
          onComplete={handleTransactionComplete}
          onError={handleTransactionError}
        />
      )}

      {currentStep === 'error' && (
        <View style={styles.errorScreen}>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Transaction Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => {
                setCurrentStep('review');
                setError(null);
              }}
            >
              <Text style={styles.errorButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.errorButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 6,
    width: '100%',
    alignItems: 'center',
  },
  errorButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});

export default CryptoToNairaTransactionFlow;
