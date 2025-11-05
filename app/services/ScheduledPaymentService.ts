/**
 * Scheduled Payment Service
 * 
 * Handles scheduled crypto-to-naira transactions using Account Abstraction.
 * User operations are created and executed at specified times.
 * 
 * Flow:
 * 1. User schedules payment with date/time
 * 2. System creates user operation and stores it
 * 3. Background service executes user operation at scheduled time
 * 4. Smart contract processes the payment
 * 5. Backend handles bank transfer
 */

import EnhancedUserOpService from './EnhancedUserOpService';
import MockTreasuryService from './MockTreasuryService';
import PaystackService, { NigerianBank } from './PaystackService';
import PriceService from './PriceService';
import SecureWalletStorage from './SecureWalletStorage';
import { useWalletStore } from '@/store/walletStore';
import TokenBalanceService from './TokenBalanceService';

export interface ScheduledRecipient {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  nairaAmount: number;
  memo?: string;
}

export interface ScheduledPaymentRequest {
  recipient: ScheduledRecipient;
  selectedToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  nairaAmount: number;
  scheduledDate: Date;
  isRecurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  recurringEndDate?: Date;
  memo?: string;
}

export interface ScheduledPaymentResult {
  scheduledId: string;
  userOperationHash?: string;
  totalCryptoNeeded: number;
  exchangeRate: number;
  gasEstimate: number;
  transactionFee: number;
  status: 'scheduled' | 'executing' | 'completed' | 'failed' | 'cancelled';
  scheduledDate: Date;
  isRecurring: boolean;
  recurringInterval?: string;
  nextExecutionDate?: Date;
}

export interface ScheduledPaymentProgress {
  scheduledId: string;
  status: string;
  scheduledDate: Date;
  executionDate?: Date;
  completionDate?: Date;
  error?: string;
}

class ScheduledPaymentService {
  private userOpService: EnhancedUserOpService;
  private chainId: number = 4202; // Lisk Sepolia testnet
  private scheduledPayments: Map<string, ScheduledPaymentResult> = new Map();

  constructor(chainId: number = 4202) {
    this.chainId = chainId;
    this.userOpService = new EnhancedUserOpService(chainId);
    this.startScheduler();
  }

  /**
   * Schedule a crypto-to-naira payment
   */
  async schedulePayment(request: ScheduledPaymentRequest): Promise<ScheduledPaymentResult> {
    try {
      console.log('⏰ Scheduling crypto-to-naira payment...', request);

      const scheduledId = this.generateScheduledId();
      
      // Validate scheduled date
      this.validateScheduledDate(request.scheduledDate);
      
      // Calculate crypto needed (using current exchange rate)
      const calculation = await this.calculateScheduledCryptoNeeded(request);
      
      // Verify bank account
      await this.verifyBankAccount(request.recipient);
      
      // Create user operation (but don't execute yet)
      const userOpResult = await this.createScheduledUserOperation(
        scheduledId,
        request,
        calculation.totalCryptoNeeded
      );
      
      // Register scheduled transaction with treasury
      const treasuryScheduled = await MockTreasuryService.registerScheduledCryptoToNairaTransaction(
        scheduledId,
        userOpResult.userOperationHash,
        request.selectedToken.symbol,
        calculation.totalCryptoNeeded,
        await SecureWalletStorage.getAddress() || '',
        request.nairaAmount,
        request.recipient,
        request.scheduledDate,
        request.isRecurring,
        request.recurringInterval,
        request.recurringEndDate,
        request.memo
      );
      
      console.log('📋 Scheduled transaction registered:', treasuryScheduled.id);
      
      const result: ScheduledPaymentResult = {
        scheduledId,
        userOperationHash: userOpResult.userOperationHash,
        totalCryptoNeeded: calculation.totalCryptoNeeded,
        exchangeRate: calculation.exchangeRate,
        gasEstimate: calculation.gasEstimate,
        transactionFee: calculation.transactionFee,
        status: 'scheduled',
        scheduledDate: request.scheduledDate,
        isRecurring: request.isRecurring,
        recurringInterval: request.recurringInterval,
        nextExecutionDate: request.scheduledDate,
      };
      
      // Store scheduled payment
      this.scheduledPayments.set(scheduledId, result);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Scheduled payment failed:', error);
      throw new Error(`Scheduled payment failed: ${error.message}`);
    }
  }

  /**
   * Calculate crypto needed for scheduled transaction
   */
  private async calculateScheduledCryptoNeeded(request: ScheduledPaymentRequest): Promise<{
    totalCryptoNeeded: number;
    exchangeRate: number;
    gasEstimate: number;
    transactionFee: number;
  }> {
    // Get current exchange rate (will be recalculated at execution time)
    const tokenPrice = await PriceService.getTokenPrice(request.selectedToken.symbol, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    
    // Calculate crypto needed for payment
    const cryptoForPayment = request.nairaAmount / exchangeRate;
    
    // Estimate gas fees
    const gasEstimate = await this.estimateScheduledGasFee();
    
    // Get Paystack transfer fees
    const paystackFee = await PaystackService.getTransferFees(request.nairaAmount);
    
    const totalCryptoNeeded = cryptoForPayment + gasEstimate;
    
    return {
      totalCryptoNeeded,
      exchangeRate,
      gasEstimate,
      transactionFee: paystackFee.fee,
    };
  }

  /**
   * Verify bank account
   */
  private async verifyBankAccount(recipient: ScheduledRecipient): Promise<void> {
    try {
      const verification = await PaystackService.verifyBankAccount(
        recipient.accountNumber,
        recipient.bankCode
      );
      
      if (verification.account_name !== recipient.accountName) {
        throw new Error(`Account name mismatch: expected ${recipient.accountName}, got ${verification.account_name}`);
      }
      
      console.log('✅ Bank account verified');
    } catch (error: any) {
      throw new Error(`Bank verification failed: ${error.message}`);
    }
  }

  /**
   * Create scheduled user operation
   */
  private async createScheduledUserOperation(
    scheduledId: string,
    request: ScheduledPaymentRequest,
    totalCryptoNeeded: number
  ): Promise<{ userOperationHash: string }> {
    try {
      // Create user operation but don't execute it yet
      // This is a mock implementation - in reality, we'd store the user operation data
      // and execute it at the scheduled time
      
      const mockUserOpHash = `0x${scheduledId}_${Date.now().toString(16)}`;
      
      console.log('📝 Created scheduled user operation:', mockUserOpHash);
      
      return {
        userOperationHash: mockUserOpHash,
      };
      
    } catch (error: any) {
      console.error('❌ Failed to create scheduled user operation:', error);
      throw new Error(`Failed to create scheduled user operation: ${error.message}`);
    }
  }

  /**
   * Execute scheduled payment at the scheduled time
   */
  async executeScheduledPayment(scheduledId: string): Promise<void> {
    try {
      console.log(`🚀 Executing scheduled payment: ${scheduledId}`);
      
      const scheduledPayment = this.scheduledPayments.get(scheduledId);
      if (!scheduledPayment) {
        throw new Error('Scheduled payment not found');
      }
      
      // Update status to executing
      scheduledPayment.status = 'executing';
      this.scheduledPayments.set(scheduledId, scheduledPayment);
      
      // Get treasury scheduled transaction
      const treasuryScheduled = MockTreasuryService.getScheduledTransaction(scheduledId);
      if (!treasuryScheduled) {
        throw new Error('Scheduled transaction not found in treasury');
      }
      
      // Execute the actual crypto-to-naira transaction
      const result = await this.userOpService.executeCryptoToNairaTransaction(
        treasuryScheduled.fiatAmount,
        {
          bankCode: treasuryScheduled.recipientData.bankCode,
          accountNumber: treasuryScheduled.recipientData.accountNumber,
          accountName: treasuryScheduled.recipientData.accountName,
        },
        {
          token: treasuryScheduled.cryptoToken,
          amount: treasuryScheduled.cryptoAmount,
        },
        treasuryScheduled.memo,
        true // Use paymaster for gas sponsorship
      );
      
      // Update treasury transaction with actual user operation hash
      treasuryScheduled.userOperationHash = result.userOperationHash;
      treasuryScheduled.status = 'executing';
      treasuryScheduled.executionDate = Date.now();
      
      MockTreasuryService.updateScheduledTransaction(treasuryScheduled);
      
      // Monitor execution progress
      await this.monitorScheduledExecution(scheduledId, treasuryScheduled.id);
      
      // Update transaction history and balances after successful execution
      await this.updateTransactionHistoryAndBalances(result, treasuryScheduled);
      
      // Update scheduled payment status
      scheduledPayment.status = 'completed';
      scheduledPayment.nextExecutionDate = this.calculateNextExecutionDate(
        scheduledPayment.scheduledDate,
        scheduledPayment.recurringInterval
      );
      
      this.scheduledPayments.set(scheduledId, scheduledPayment);
      
      console.log(`✅ Scheduled payment ${scheduledId} executed successfully`);
      
    } catch (error: any) {
      console.error(`❌ Failed to execute scheduled payment ${scheduledId}:`, error);
      
      const scheduledPayment = this.scheduledPayments.get(scheduledId);
      if (scheduledPayment) {
        scheduledPayment.status = 'failed';
        this.scheduledPayments.set(scheduledId, scheduledPayment);
      }
      
      throw error;
    }
  }

  /**
   * Monitor scheduled payment execution
   */
  private async monitorScheduledExecution(
    scheduledId: string,
    treasuryScheduledId: string
  ): Promise<void> {
    const maxWaitTime = 60000; // 1 minute (reduced from 5 minutes)
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second (reduced from 5 seconds)
    
    while (Date.now() - startTime < maxWaitTime) {
      const treasuryScheduled = MockTreasuryService.getScheduledTransaction(treasuryScheduledId);
      
      if (!treasuryScheduled) {
        throw new Error('Scheduled transaction not found in treasury');
      }
      
      // Update UI based on scheduled transaction status
      switch (treasuryScheduled.status) {
        case 'executing':
          console.log(`⏰ Scheduled ${scheduledId}: Executing payment...`);
          break;
        case 'crypto_received':
          console.log(`⏰ Scheduled ${scheduledId}: Crypto received ✅ Converting to naira...`);
          break;
        case 'fiat_processing':
          console.log(`⏰ Scheduled ${scheduledId}: Processing naira payment...`);
          break;
        case 'fiat_sent':
          console.log(`⏰ Scheduled ${scheduledId}: Naira sent to bank account ✅`);
          break;
        case 'completed':
          console.log(`🎉 Scheduled ${scheduledId}: Payment completed successfully!`);
          return;
        case 'failed':
          throw new Error(treasuryScheduled.error || 'Scheduled payment failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Scheduled payment monitoring timeout');
  }

  /**
   * Start the scheduler to check for due payments
   */
  private startScheduler(): void {
    // Check every minute for due payments
    setInterval(() => {
      this.checkAndExecuteDuePayments();
    }, 60000); // 1 minute
    
    console.log('⏰ Scheduled payment scheduler started');
  }

  /**
   * Check and execute due payments
   */
  private async checkAndExecuteDuePayments(): Promise<void> {
    const now = new Date();
    
    for (const [scheduledId, scheduledPayment] of this.scheduledPayments) {
      if (scheduledPayment.status === 'scheduled' && 
          scheduledPayment.nextExecutionDate && 
          scheduledPayment.nextExecutionDate <= now) {
        
        try {
          await this.executeScheduledPayment(scheduledId);
        } catch (error: any) {
          console.error(`❌ Failed to execute scheduled payment ${scheduledId}:`, error);
        }
      }
    }
  }

  /**
   * Calculate next execution date for recurring payments
   */
  private calculateNextExecutionDate(
    currentDate: Date,
    recurringInterval?: string
  ): Date | undefined {
    if (!recurringInterval) {
      return undefined;
    }
    
    const nextDate = new Date(currentDate);
    
    switch (recurringInterval) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    
    return nextDate;
  }

  /**
   * Get scheduled payment status
   */
  async getScheduledStatus(scheduledId: string): Promise<ScheduledPaymentProgress | null> {
    try {
      const scheduledPayment = this.scheduledPayments.get(scheduledId);
      
      if (!scheduledPayment) {
        return null;
      }
      
      const treasuryScheduled = MockTreasuryService.getScheduledTransaction(scheduledId);
      
      return {
        scheduledId,
        status: scheduledPayment.status,
        scheduledDate: scheduledPayment.scheduledDate,
        executionDate: treasuryScheduled?.executionDate ? new Date(treasuryScheduled.executionDate) : undefined,
        completionDate: treasuryScheduled?.completedAt ? new Date(treasuryScheduled.completedAt) : undefined,
        error: treasuryScheduled?.error,
      };
      
    } catch (error: any) {
      console.error('❌ Failed to get scheduled status:', error);
      return null;
    }
  }

  /**
   * Cancel scheduled payment
   */
  async cancelScheduledPayment(scheduledId: string): Promise<boolean> {
    try {
      const scheduledPayment = this.scheduledPayments.get(scheduledId);
      
      if (!scheduledPayment) {
        return false;
      }
      
      if (scheduledPayment.status === 'scheduled') {
        scheduledPayment.status = 'cancelled';
        this.scheduledPayments.set(scheduledId, scheduledPayment);
        
        // Update treasury
        const treasuryScheduled = MockTreasuryService.getScheduledTransaction(scheduledId);
        if (treasuryScheduled) {
          treasuryScheduled.status = 'cancelled';
          MockTreasuryService.updateScheduledTransaction(treasuryScheduled);
        }
        
        console.log(`❌ Scheduled payment ${scheduledId} cancelled`);
        return true;
      }
      
      return false; // Cannot cancel if already executing or completed
      
    } catch (error: any) {
      console.error('❌ Failed to cancel scheduled payment:', error);
      return false;
    }
  }

  /**
   * Get all scheduled payments
   */
  getAllScheduledPayments(): ScheduledPaymentResult[] {
    return Array.from(this.scheduledPayments.values());
  }

  /**
   * Estimate gas fee for scheduled transaction
   */
  private async estimateScheduledGasFee(): Promise<number> {
    // Same as regular transaction since it's executed the same way
    return 0.01; // 0.01 ETH equivalent
  }

  /**
   * Validate scheduled date
   */
  private validateScheduledDate(scheduledDate: Date): void {
    const now = new Date();
    const minDate = new Date(now.getTime() + 60000); // At least 1 minute in the future
    
    if (scheduledDate < minDate) {
      throw new Error('Scheduled date must be at least 1 minute in the future');
    }
    
    const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Max 1 year in the future
    
    if (scheduledDate > maxDate) {
      throw new Error('Scheduled date cannot be more than 1 year in the future');
    }
  }

  /**
   * Generate unique scheduled ID
   */
  private generateScheduledId(): string {
    return `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate scheduled payment request
   */
  validateScheduledRequest(request: ScheduledPaymentRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!request.recipient.bankCode) {
      errors.push('Bank code is required');
    }
    
    if (!request.recipient.accountNumber || request.recipient.accountNumber.length !== 10) {
      errors.push('Account number must be 10 digits');
    }
    
    if (!request.recipient.accountName) {
      errors.push('Account name is required');
    }
    
    if (request.nairaAmount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (request.nairaAmount > 100000) {
      errors.push('Maximum amount is ₦100,000');
    }
    
    if (!request.scheduledDate) {
      errors.push('Scheduled date is required');
    }
    
    if (request.isRecurring && !request.recurringInterval) {
      errors.push('Recurring interval is required for recurring payments');
    }
    
    if (request.isRecurring && request.recurringEndDate && request.recurringEndDate <= request.scheduledDate) {
      errors.push('Recurring end date must be after scheduled date');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update transaction history and balances after successful scheduled payment execution
   */
  private async updateTransactionHistoryAndBalances(
    result: { userOperationHash: string },
    treasuryScheduled: any
  ): Promise<void> {
    try {
      console.log('📝 Updating transaction history and balances for scheduled payment...');
      
      // Get wallet store instance
      const walletStore = useWalletStore.getState();
      
      // Create transaction record
      const transaction = {
        id: `scheduled_${result.userOperationHash}`,
        type: 'scheduled_crypto_to_naira' as const,
        status: 'completed' as const,
        from: walletStore.wallet.address || '',
        to: `${treasuryScheduled.recipientData.bankCode}:${treasuryScheduled.recipientData.accountNumber}`,
        amount: treasuryScheduled.fiatAmount,
        currency: 'NGN',
        token: treasuryScheduled.cryptoToken,
        tokenAmount: treasuryScheduled.cryptoAmount,
        timestamp: Date.now(),
        hash: result.userOperationHash,
        memo: treasuryScheduled.memo || `Scheduled payment to ${treasuryScheduled.recipientData.accountName}`,
        network: 'ethereum',
        gasUsed: treasuryScheduled.fees.cryptoNetworkFee,
        gasPrice: 0,
        fees: {
          network: treasuryScheduled.fees.cryptoNetworkFee,
          platform: treasuryScheduled.fees.paystackFee,
          total: treasuryScheduled.fees.cryptoNetworkFee + treasuryScheduled.fees.paystackFee,
        },
        recipient: {
          bankCode: treasuryScheduled.recipientData.bankCode,
          accountNumber: treasuryScheduled.recipientData.accountNumber,
          accountName: treasuryScheduled.recipientData.accountName,
        },
        scheduledDate: treasuryScheduled.scheduledDate,
        executedDate: treasuryScheduled.executionDate,
        isRecurring: treasuryScheduled.isRecurring,
        recurringInterval: treasuryScheduled.recurringInterval,
      };

      // Add transaction to the store
      walletStore.addTransaction(transaction);

      // Update token balances
      await this.updateTokenBalances(treasuryScheduled.cryptoToken, treasuryScheduled.cryptoAmount);
      
      console.log('✅ Added scheduled transaction to history');
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

export default ScheduledPaymentService;
