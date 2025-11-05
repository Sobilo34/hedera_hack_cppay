/**
 * Batch Payment Service
 * 
 * Handles batch crypto-to-naira transactions using Account Abstraction.
 * Multiple recipients can be paid in a single user operation, reducing gas costs.
 * 
 * Flow:
 * 1. User creates batch with multiple recipients
 * 2. System calculates total crypto needed for all payments
 * 3. Single user operation created for batch execution
 * 4. Smart contract processes all payments atomically
 * 5. Backend handles individual bank transfers
 */

import EnhancedUserOpService from './EnhancedUserOpService';
import MockTreasuryService from './MockTreasuryService';
import PaystackService, { NigerianBank } from './PaystackService';
import PriceService from './PriceService';
import SecureWalletStorage from './SecureWalletStorage';
import { useWalletStore } from '@/store/walletStore';
import TokenBalanceService from './TokenBalanceService';

export interface BatchRecipient {
  id: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  nairaAmount: number;
  memo?: string;
}

export interface BatchPaymentRequest {
  recipients: BatchRecipient[];
  selectedToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  totalNairaAmount: number;
  memo?: string;
}

export interface BatchPaymentResult {
  batchId: string;
  userOperationHash: string;
  totalCryptoNeeded: number;
  exchangeRate: number;
  gasEstimate: number;
  transactionFee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  individualResults: Array<{
    recipientId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }>;
}

export interface BatchTransactionProgress {
  batchId: string;
  status: string;
  completedRecipients: number;
  totalRecipients: number;
  currentRecipient?: string;
  error?: string;
}

class BatchPaymentService {
  private userOpService: EnhancedUserOpService;
  private chainId: number = 4202; // Lisk Sepolia testnet

  constructor(chainId: number = 4202) {
    this.chainId = chainId;
    this.userOpService = new EnhancedUserOpService(chainId);
  }

  /**
   * Create and execute batch crypto-to-naira transaction
   */
  async executeBatchPayment(request: BatchPaymentRequest): Promise<BatchPaymentResult> {
    try {
      console.log('📦 Executing batch crypto-to-naira payment...', request);

      const batchId = this.generateBatchId();
      
      // Calculate total crypto needed
      const calculation = await this.calculateBatchCryptoNeeded(request);
      
      // Verify all bank accounts
      await this.verifyAllBankAccounts(request.recipients);
      
      // Create batch user operation
      const userOpResult = await this.createBatchUserOperation(
        batchId,
        request,
        calculation.totalCryptoNeeded
      );
      
      // Register batch transaction with treasury
      const treasuryBatch = await MockTreasuryService.registerBatchCryptoToNairaTransaction(
        batchId,
        userOpResult.userOperationHash,
        request.selectedToken.symbol,
        calculation.totalCryptoNeeded,
        await SecureWalletStorage.getAddress() || '',
        request.totalNairaAmount,
        request.recipients,
        request.memo
      );
      
      console.log('📋 Batch transaction registered:', treasuryBatch.id);
      
      const result: BatchPaymentResult = {
        batchId,
        userOperationHash: userOpResult.userOperationHash,
        totalCryptoNeeded: calculation.totalCryptoNeeded,
        exchangeRate: calculation.exchangeRate,
        gasEstimate: calculation.gasEstimate,
        transactionFee: calculation.transactionFee,
        status: 'processing',
        individualResults: request.recipients.map(recipient => ({
          recipientId: recipient.id,
          status: 'pending',
        })),
      };
      
      // Start monitoring batch progress
      this.monitorBatchProgress(batchId, treasuryBatch.id);
      
      // Update transaction history and balances after successful batch
      await this.updateTransactionHistoryAndBalances(result, request);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Batch payment failed:', error);
      throw new Error(`Batch payment failed: ${error.message}`);
    }
  }

  /**
   * Calculate total crypto needed for batch transaction
   */
  private async calculateBatchCryptoNeeded(request: BatchPaymentRequest): Promise<{
    totalCryptoNeeded: number;
    exchangeRate: number;
    gasEstimate: number;
    transactionFee: number;
  }> {
    // Get current exchange rate
    const tokenPrice = await PriceService.getTokenPrice(request.selectedToken.symbol, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    
    // Calculate crypto needed for all payments
    const cryptoForPayments = request.totalNairaAmount / exchangeRate;
    
    // Estimate gas fees (single transaction for batch)
    const gasEstimate = await this.estimateBatchGasFee(request.recipients.length);
    
    // Get Paystack transfer fees
    const paystackFee = await PaystackService.getTransferFees(request.totalNairaAmount);
    
    const totalCryptoNeeded = cryptoForPayments + gasEstimate;
    
    return {
      totalCryptoNeeded,
      exchangeRate,
      gasEstimate,
      transactionFee: paystackFee.fee,
    };
  }

  /**
   * Verify all bank accounts in the batch
   */
  private async verifyAllBankAccounts(recipients: BatchRecipient[]): Promise<void> {
    const verificationPromises = recipients.map(async (recipient) => {
      try {
        const verification = await PaystackService.verifyBankAccount(
          recipient.accountNumber,
          recipient.bankCode
        );
        
        // If account name is empty or doesn't match, update it with the verified name
        if (!recipient.accountName || verification.account_name !== recipient.accountName) {
          console.log(`📝 Updating account name for ${recipient.id}: "${recipient.accountName}" → "${verification.account_name}"`);
          recipient.accountName = verification.account_name;
        }
        
        return { recipientId: recipient.id, verified: true };
      } catch (error: any) {
        throw new Error(`Bank verification failed for ${recipient.id}: ${error.message}`);
      }
    });
    
    await Promise.all(verificationPromises);
    console.log('✅ All bank accounts verified');
  }

  /**
   * Create batch user operation
   */
  private async createBatchUserOperation(
    batchId: string,
    request: BatchPaymentRequest,
    totalCryptoNeeded: number
  ): Promise<{ userOperationHash: string }> {
    try {
      // Create batch user operation using EnhancedUserOpService
      const result = await this.userOpService.executeBatchCryptoToNairaTransaction(
        request.totalNairaAmount,
        request.recipients.map(recipient => ({
          bankCode: recipient.bankCode,
          accountNumber: recipient.accountNumber,
          accountName: recipient.accountName,
          amount: recipient.nairaAmount,
        })),
        {
          token: request.selectedToken.symbol,
          amount: totalCryptoNeeded,
        },
        request.memo,
        true // Use paymaster for gas sponsorship
      );
      
      return {
        userOperationHash: result.userOperationHash,
      };
      
    } catch (error: any) {
      console.error('❌ Failed to create batch user operation:', error);
      throw new Error(`Failed to create batch user operation: ${error.message}`);
    }
  }

  /**
   * Monitor batch transaction progress
   */
  private async monitorBatchProgress(
    batchId: string,
    treasuryBatchId: string
  ): Promise<void> {
    const maxWaitTime = 60000; // 1 minute (reduced from 5 minutes)
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second (reduced from 5 seconds)
    
    while (Date.now() - startTime < maxWaitTime) {
      const treasuryBatch = MockTreasuryService.getBatchTransaction(treasuryBatchId);
      
      if (!treasuryBatch) {
        throw new Error('Batch transaction not found in treasury');
      }
      
      // Update UI based on batch status
      switch (treasuryBatch.status) {
        case 'pending':
          console.log(`📦 Batch ${batchId}: Waiting for crypto confirmation...`);
          break;
        case 'crypto_received':
          console.log(`📦 Batch ${batchId}: Crypto received ✅ Processing individual payments...`);
          break;
        case 'processing':
          console.log(`📦 Batch ${batchId}: Processing ${treasuryBatch.completedRecipients}/${treasuryBatch.totalRecipients} recipients...`);
          break;
        case 'completed':
          console.log(`🎉 Batch ${batchId}: All payments completed successfully!`);
          return;
        case 'failed':
          throw new Error(treasuryBatch.error || 'Batch transaction failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Batch transaction monitoring timeout');
  }

  /**
   * Estimate gas fee for batch transaction
   */
  private async estimateBatchGasFee(recipientCount: number): Promise<number> {
    // Base gas + additional gas per recipient
    const baseGas = 0.01; // Base gas cost
    const perRecipientGas = 0.002; // Additional gas per recipient
    
    return baseGas + (perRecipientGas * recipientCount);
  }

  /**
   * Get batch transaction status
   */
  async getBatchStatus(batchId: string): Promise<BatchTransactionProgress | null> {
    try {
      const treasuryBatch = MockTreasuryService.getBatchTransaction(batchId);
      
      if (!treasuryBatch) {
        return null;
      }
      
      return {
        batchId,
        status: treasuryBatch.status,
        completedRecipients: treasuryBatch.completedRecipients,
        totalRecipients: treasuryBatch.totalRecipients,
        currentRecipient: treasuryBatch.currentRecipient,
        error: treasuryBatch.error,
      };
      
    } catch (error: any) {
      console.error('❌ Failed to get batch status:', error);
      return null;
    }
  }

  /**
   * Cancel batch transaction (if still pending)
   */
  async cancelBatchTransaction(batchId: string): Promise<boolean> {
    try {
      const treasuryBatch = MockTreasuryService.getBatchTransaction(batchId);
      
      if (!treasuryBatch) {
        return false;
      }
      
      if (treasuryBatch.status === 'pending') {
        treasuryBatch.status = 'cancelled';
        MockTreasuryService.updateBatchTransaction(treasuryBatch);
        console.log(`❌ Batch transaction ${batchId} cancelled`);
        return true;
      }
      
      return false; // Cannot cancel if already processing
      
    } catch (error: any) {
      console.error('❌ Failed to cancel batch transaction:', error);
      return false;
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate batch payment request
   */
  validateBatchRequest(request: BatchPaymentRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!request.recipients || request.recipients.length === 0) {
      errors.push('At least one recipient is required');
    }
    
    if (request.recipients.length > 50) {
      errors.push('Maximum 50 recipients allowed per batch');
    }
    
    if (request.totalNairaAmount <= 0) {
      errors.push('Total amount must be greater than 0');
    }
    
    if (request.totalNairaAmount > 1000000) {
      errors.push('Maximum batch amount is ₦1,000,000');
    }
    
    // Validate individual recipients
    request.recipients.forEach((recipient, index) => {
      if (!recipient.bankCode) {
        errors.push(`Recipient ${index + 1}: Bank code is required`);
      }
      
      if (!recipient.accountNumber || recipient.accountNumber.length !== 10) {
        errors.push(`Recipient ${index + 1}: Account number must be 10 digits`);
      }
      
      if (!recipient.accountName) {
        errors.push(`Recipient ${index + 1}: Account name is required`);
      }
      
      if (recipient.nairaAmount <= 0) {
        errors.push(`Recipient ${index + 1}: Amount must be greater than 0`);
      }
      
      if (recipient.nairaAmount > 100000) {
        errors.push(`Recipient ${index + 1}: Maximum amount is ₦100,000`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update transaction history and balances after successful batch transaction
   */
  private async updateTransactionHistoryAndBalances(
    result: { userOperationHash: string },
    request: BatchPaymentRequest
  ): Promise<void> {
    try {
      console.log('📝 Updating transaction history and balances...');
      
      // Get wallet store instance
      const walletStore = useWalletStore.getState();
      
      // Create transaction record for each recipient
      const transactions = request.recipients.map((recipient, index) => ({
        id: `batch_${result.userOperationHash}_${index}`,
        type: 'batch_crypto_to_naira' as const,
        status: 'completed' as const,
        from: walletStore.wallet.address || '',
        to: `${recipient.bankCode}:${recipient.accountNumber}`,
        amount: recipient.nairaAmount,
        currency: 'NGN',
        token: request.selectedToken.symbol,
        tokenAmount: (recipient.nairaAmount / request.exchangeRate),
        timestamp: Date.now(),
        hash: result.userOperationHash,
        memo: request.memo || `Batch payment to ${recipient.accountName}`,
        network: 'ethereum',
        gasUsed: request.gasEstimate / request.recipients.length, // Distribute gas among recipients
        gasPrice: 0,
        fees: {
          network: request.gasEstimate / request.recipients.length,
          platform: request.transactionFee / request.recipients.length,
          total: (request.gasEstimate + request.transactionFee) / request.recipients.length,
        },
        recipient: {
          bankCode: recipient.bankCode,
          accountNumber: recipient.accountNumber,
          accountName: recipient.accountName,
        },
      }));

      // Add all transactions to the store
      transactions.forEach(transaction => {
        walletStore.addTransaction(transaction);
      });

      // Update token balances
      await this.updateTokenBalances(request.selectedToken.symbol, request.totalCryptoNeeded);
      
      console.log(`✅ Added ${transactions.length} batch transactions to history`);
    } catch (error) {
      console.error('❌ Failed to update transaction history:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Update token balances after transaction
   */
  private async updateTokenBalances(tokenSymbol: string, amountUsed: number): Promise<void> {
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
  }
}

export default BatchPaymentService;
