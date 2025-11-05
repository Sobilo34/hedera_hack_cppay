/**
 * Mock CPPay Treasury Service
 * 
 * Simulates CPPay's backend treasury operations for crypto-to-naira transactions.
 * This service handles the complete flow of:
 * 1. Monitoring blockchain for crypto receipts
 * 2. Converting crypto to fiat pools
 * 3. Processing naira payments via Paystack
 * 4. Transaction reconciliation and status updates
 */

import PaystackService from './PaystackService';
import PriceService from './PriceService';

export interface TreasuryTransaction {
  id: string;
  userOperationHash: string;
  type: 'crypto_to_naira' | 'airtime' | 'electricity' | 'cabletv' | 'data';
  status: 'pending' | 'crypto_received' | 'fiat_processing' | 'fiat_sent' | 'completed' | 'failed';
  
  // Crypto details
  cryptoToken: string;
  cryptoAmount: number;
  cryptoValue: number; // Value in USD/NGN
  senderAddress: string;
  
  // Fiat details
  fiatAmount: number;
  fiatCurrency: string;
  
  // Recipient details
  recipientData: {
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
    phoneNumber?: string;
    meterNumber?: string;
    smartCardNumber?: string;
    provider?: string;
  };
  
  // Payment tracking
  paystackReference?: string;
  paystackRecipientCode?: string;
  
  // Timestamps
  createdAt: number;
  cryptoReceivedAt?: number;
  fiatSentAt?: number;
  completedAt?: number;
  
  // Metadata
  memo?: string;
  exchangeRate?: number;
  fees: {
    cryptoNetworkFee: number;
    conversionFee: number;
    paystackFee: number;
    cppayFee: number;
  };
  
  // Error handling
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface BatchTreasuryTransaction {
  id: string;
  userOperationHash: string;
  type: 'batch_crypto_to_naira';
  status: 'pending' | 'crypto_received' | 'processing' | 'completed' | 'failed';
  
  // Crypto details
  cryptoToken: string;
  totalCryptoAmount: number;
  totalCryptoValue: number;
  senderAddress: string;
  
  // Batch details
  totalFiatAmount: number;
  fiatCurrency: string;
  recipients: Array<{
    id: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    nairaAmount: number;
    memo?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }>;
  
  // Progress tracking
  completedRecipients: number;
  totalRecipients: number;
  currentRecipient?: string;
  
  // Timestamps
  createdAt: number;
  cryptoReceivedAt?: number;
  completedAt?: number;
  
  // Metadata
  memo?: string;
  exchangeRate?: number;
  fees: {
    cryptoNetworkFee: number;
    conversionFee: number;
    paystackFee: number;
    cppayFee: number;
  };
  
  // Error handling
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ScheduledTreasuryTransaction {
  id: string;
  userOperationHash?: string;
  type: 'scheduled_crypto_to_naira';
  status: 'scheduled' | 'executing' | 'crypto_received' | 'fiat_processing' | 'fiat_sent' | 'completed' | 'failed' | 'cancelled';
  
  // Crypto details
  cryptoToken: string;
  cryptoAmount: number;
  cryptoValue: number;
  senderAddress: string;
  
  // Fiat details
  fiatAmount: number;
  fiatCurrency: string;
  
  // Recipient details
  recipientData: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
  
  // Scheduling details
  scheduledDate: number;
  executionDate?: number;
  isRecurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  recurringEndDate?: number;
  nextExecutionDate?: number;
  
  // Payment tracking
  paystackReference?: string;
  paystackRecipientCode?: string;
  
  // Timestamps
  createdAt: number;
  cryptoReceivedAt?: number;
  fiatSentAt?: number;
  completedAt?: number;
  
  // Metadata
  memo?: string;
  exchangeRate?: number;
  fees: {
    cryptoNetworkFee: number;
    conversionFee: number;
    paystackFee: number;
    cppayFee: number;
  };
  
  // Error handling
  error?: string;
  retryCount: number;
  maxRetries: number;
}

class MockTreasuryService {
  private transactions: Map<string, TreasuryTransaction> = new Map();
  private batchTransactions: Map<string, BatchTreasuryTransaction> = new Map();
  private scheduledTransactions: Map<string, ScheduledTreasuryTransaction> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  
  // Treasury configuration
  private readonly CPPAY_TREASURY_ADDRESS = '0x742a3dc71ba84ad033bf1d6413dd39366d88bb4c'; // Mock treasury address
  private readonly CONVERSION_FEE_PERCENTAGE = 0.5; // 0.5% conversion fee
  private readonly CPPAY_FEE_PERCENTAGE = 1.0; // 1% CPPay service fee
  
  // Processing delays (in milliseconds) - Optimized for better UX
  private readonly CRYPTO_CONFIRMATION_DELAY = 3000; // 3 seconds (was 30 seconds)
  private readonly FIAT_PROCESSING_DELAY = 2000; // 2 seconds (was 60 seconds)
  private readonly PAYMENT_EXECUTION_DELAY = 2000; // 2 seconds (was 45 seconds)

  constructor() {
    console.log('🏦 Mock Treasury Service initialized');
    this.startProcessingLoop();
  }

  /**
   * Register a new crypto-to-naira transaction for processing
   */
  async registerCryptoToNairaTransaction(
    userOperationHash: string,
    cryptoToken: string,
    cryptoAmount: number,
    senderAddress: string,
    nairaAmount: number,
    bankDetails: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    },
    memo?: string
  ): Promise<TreasuryTransaction> {
    const transactionId = this.generateTransactionId();
    
    // Get current exchange rate
    const tokenPrice = await PriceService.getTokenPrice(cryptoToken, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    const cryptoValue = cryptoAmount * exchangeRate;
    
    // Calculate fees
    const cryptoNetworkFee = this.estimateNetworkFee(cryptoToken);
    const conversionFee = cryptoValue * (this.CONVERSION_FEE_PERCENTAGE / 100);
    const paystackFee = await this.getPaystackFee(nairaAmount);
    const cppayFee = nairaAmount * (this.CPPAY_FEE_PERCENTAGE / 100);
    
    const transaction: TreasuryTransaction = {
      id: transactionId,
      userOperationHash,
      type: 'crypto_to_naira',
      status: 'pending',
      cryptoToken,
      cryptoAmount,
      cryptoValue,
      senderAddress,
      fiatAmount: nairaAmount,
      fiatCurrency: 'NGN',
      recipientData: {
        bankCode: bankDetails.bankCode,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
      },
      createdAt: Date.now(),
      memo,
      exchangeRate,
      fees: {
        cryptoNetworkFee,
        conversionFee,
        paystackFee,
        cppayFee,
      },
      retryCount: 0,
      maxRetries: 3,
    };

    this.transactions.set(transactionId, transaction);
    
    console.log(`📝 Registered crypto-to-naira transaction: ${transactionId}`);
    console.log(`   ${cryptoAmount} ${cryptoToken} → ₦${nairaAmount}`);
    console.log(`   Recipient: ${bankDetails.accountName} (${bankDetails.accountNumber})`);
    
    return transaction;
  }

  /**
   * Register other bill payment transactions
   */
  async registerBillPayment(
    userOperationHash: string,
    type: 'airtime' | 'electricity' | 'cabletv' | 'data',
    cryptoToken: string,
    cryptoAmount: number,
    senderAddress: string,
    nairaAmount: number,
    recipientData: any,
    provider: string
  ): Promise<TreasuryTransaction> {
    const transactionId = this.generateTransactionId();
    
    // Get current exchange rate
    const tokenPrice = await PriceService.getTokenPrice(cryptoToken, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    const cryptoValue = cryptoAmount * exchangeRate;
    
    // Calculate fees
    const cryptoNetworkFee = this.estimateNetworkFee(cryptoToken);
    const conversionFee = cryptoValue * (this.CONVERSION_FEE_PERCENTAGE / 100);
    const cppayFee = nairaAmount * (this.CPPAY_FEE_PERCENTAGE / 100);
    
    const transaction: TreasuryTransaction = {
      id: transactionId,
      userOperationHash,
      type,
      status: 'pending',
      cryptoToken,
      cryptoAmount,
      cryptoValue,
      senderAddress,
      fiatAmount: nairaAmount,
      fiatCurrency: 'NGN',
      recipientData: {
        ...recipientData,
        provider,
      },
      createdAt: Date.now(),
      exchangeRate,
      fees: {
        cryptoNetworkFee,
        conversionFee,
        paystackFee: 0, // No Paystack fee for bill payments (handled by provider)
        cppayFee,
      },
      retryCount: 0,
      maxRetries: 3,
    };

    this.transactions.set(transactionId, transaction);
    
    console.log(`📝 Registered ${type} payment: ${transactionId}`);
    console.log(`   ${cryptoAmount} ${cryptoToken} → ₦${nairaAmount} ${type}`);
    
    return transaction;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): TreasuryTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Get transaction by UserOperation hash
   */
  getTransactionByUserOpHash(userOpHash: string): TreasuryTransaction | undefined {
    for (const transaction of this.transactions.values()) {
      if (transaction.userOperationHash === userOpHash) {
        return transaction;
      }
    }
    return undefined;
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): TreasuryTransaction[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Register a batch crypto-to-naira transaction
   */
  async registerBatchCryptoToNairaTransaction(
    batchId: string,
    userOperationHash: string,
    cryptoToken: string,
    totalCryptoAmount: number,
    senderAddress: string,
    totalNairaAmount: number,
    recipients: Array<{
      id: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      nairaAmount: number;
      memo?: string;
    }>,
    memo?: string
  ): Promise<BatchTreasuryTransaction> {
    // Get current exchange rate
    const tokenPrice = await PriceService.getTokenPrice(cryptoToken, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    const totalCryptoValue = totalCryptoAmount * exchangeRate;
    
    // Calculate fees
    const cryptoNetworkFee = this.estimateNetworkFee(cryptoToken);
    const conversionFee = totalCryptoValue * (this.CONVERSION_FEE_PERCENTAGE / 100);
    const paystackFee = await this.getPaystackFee(totalNairaAmount);
    const cppayFee = totalNairaAmount * (this.CPPAY_FEE_PERCENTAGE / 100);
    
    const batchTransaction: BatchTreasuryTransaction = {
      id: batchId,
      userOperationHash,
      type: 'batch_crypto_to_naira',
      status: 'pending',
      cryptoToken,
      totalCryptoAmount,
      totalCryptoValue,
      senderAddress,
      totalFiatAmount: totalNairaAmount,
      fiatCurrency: 'NGN',
      recipients: recipients.map(recipient => ({
        ...recipient,
        status: 'pending' as const,
      })),
      completedRecipients: 0,
      totalRecipients: recipients.length,
      createdAt: Date.now(),
      memo,
      exchangeRate,
      fees: {
        cryptoNetworkFee,
        conversionFee,
        paystackFee,
        cppayFee,
      },
      retryCount: 0,
      maxRetries: 3,
    };

    this.batchTransactions.set(batchId, batchTransaction);
    
    console.log(`📝 Registered batch crypto-to-naira transaction: ${batchId}`);
    console.log(`   ${totalCryptoAmount} ${cryptoToken} → ₦${totalNairaAmount} (${recipients.length} recipients)`);
    
    return batchTransaction;
  }

  /**
   * Register a scheduled crypto-to-naira transaction
   */
  async registerScheduledCryptoToNairaTransaction(
    scheduledId: string,
    userOperationHash: string,
    cryptoToken: string,
    cryptoAmount: number,
    senderAddress: string,
    nairaAmount: number,
    recipient: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    },
    scheduledDate: Date,
    isRecurring: boolean,
    recurringInterval?: 'daily' | 'weekly' | 'monthly',
    recurringEndDate?: Date,
    memo?: string
  ): Promise<ScheduledTreasuryTransaction> {
    // Get current exchange rate
    const tokenPrice = await PriceService.getTokenPrice(cryptoToken, 'ngn');
    const exchangeRate = parseFloat(tokenPrice.price);
    const cryptoValue = cryptoAmount * exchangeRate;
    
    // Calculate fees
    const cryptoNetworkFee = this.estimateNetworkFee(cryptoToken);
    const conversionFee = cryptoValue * (this.CONVERSION_FEE_PERCENTAGE / 100);
    const paystackFee = await this.getPaystackFee(nairaAmount);
    const cppayFee = nairaAmount * (this.CPPAY_FEE_PERCENTAGE / 100);
    
    const scheduledTransaction: ScheduledTreasuryTransaction = {
      id: scheduledId,
      userOperationHash,
      type: 'scheduled_crypto_to_naira',
      status: 'scheduled',
      cryptoToken,
      cryptoAmount,
      cryptoValue,
      senderAddress,
      fiatAmount: nairaAmount,
      fiatCurrency: 'NGN',
      recipientData: {
        bankCode: recipient.bankCode,
        accountNumber: recipient.accountNumber,
        accountName: recipient.accountName,
      },
      scheduledDate: scheduledDate.getTime(),
      isRecurring,
      recurringInterval,
      recurringEndDate: recurringEndDate?.getTime(),
      nextExecutionDate: scheduledDate.getTime(),
      createdAt: Date.now(),
      memo,
      exchangeRate,
      fees: {
        cryptoNetworkFee,
        conversionFee,
        paystackFee,
        cppayFee,
      },
      retryCount: 0,
      maxRetries: 3,
    };

    this.scheduledTransactions.set(scheduledId, scheduledTransaction);
    
    console.log(`📝 Registered scheduled crypto-to-naira transaction: ${scheduledId}`);
    console.log(`   ${cryptoAmount} ${cryptoToken} → ₦${nairaAmount}`);
    console.log(`   Scheduled for: ${scheduledDate.toISOString()}`);
    console.log(`   Recurring: ${isRecurring ? recurringInterval : 'No'}`);
    
    return scheduledTransaction;
  }

  /**
   * Get batch transaction by ID
   */
  getBatchTransaction(batchId: string): BatchTreasuryTransaction | undefined {
    return this.batchTransactions.get(batchId);
  }

  /**
   * Get scheduled transaction by ID
   */
  getScheduledTransaction(scheduledId: string): ScheduledTreasuryTransaction | undefined {
    return this.scheduledTransactions.get(scheduledId);
  }

  /**
   * Update batch transaction
   */
  updateBatchTransaction(batchTransaction: BatchTreasuryTransaction): void {
    this.batchTransactions.set(batchTransaction.id, batchTransaction);
  }

  /**
   * Update scheduled transaction
   */
  updateScheduledTransaction(scheduledTransaction: ScheduledTreasuryTransaction): void {
    this.scheduledTransactions.set(scheduledTransaction.id, scheduledTransaction);
  }

  /**
   * Get all batch transactions
   */
  getAllBatchTransactions(): BatchTreasuryTransaction[] {
    return Array.from(this.batchTransactions.values());
  }

  /**
   * Get all scheduled transactions
   */
  getAllScheduledTransactions(): ScheduledTreasuryTransaction[] {
    return Array.from(this.scheduledTransactions.values());
  }

  /**
   * Get transactions by status
   */
  getTransactionsByStatus(status: TreasuryTransaction['status']): TreasuryTransaction[] {
    return Array.from(this.transactions.values()).filter(tx => tx.status === status);
  }

  /**
   * Start the processing loop that handles transaction lifecycle
   */
  private startProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processTransactions();
    }, 10000); // Process every 10 seconds

    console.log('🔄 Treasury processing loop started');
  }

  /**
   * Stop the processing loop
   */
  stopProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏹️ Treasury processing loop stopped');
    }
  }

  /**
   * Process all pending transactions
   */
  private async processTransactions(): Promise<void> {
    const pendingTransactions = this.getTransactionsByStatus('pending');
    const cryptoReceivedTransactions = this.getTransactionsByStatus('crypto_received');
    const fiatProcessingTransactions = this.getTransactionsByStatus('fiat_processing');

    // Process pending transactions (check for crypto confirmation)
    for (const tx of pendingTransactions) {
      await this.processPendingTransaction(tx);
    }

    // Process crypto received transactions (convert to fiat)
    for (const tx of cryptoReceivedTransactions) {
      await this.processCryptoReceivedTransaction(tx);
    }

    // Process fiat processing transactions (execute payments)
    for (const tx of fiatProcessingTransactions) {
      await this.processFiatProcessingTransaction(tx);
    }
  }

  /**
   * Process a pending transaction (simulate crypto confirmation)
   */
  private async processPendingTransaction(tx: TreasuryTransaction): Promise<void> {
    const now = Date.now();
    const timeSinceCreated = now - tx.createdAt;

    // Simulate crypto confirmation delay
    if (timeSinceCreated >= this.CRYPTO_CONFIRMATION_DELAY) {
      console.log(`🟢 Crypto confirmed for transaction ${tx.id}`);
      
      tx.status = 'crypto_received';
      tx.cryptoReceivedAt = now;
      
      this.transactions.set(tx.id, tx);
      
      // Emit event for UI updates
      this.emitTransactionUpdate(tx);
    }
  }

  /**
   * Process a crypto received transaction (simulate conversion to fiat)
   */
  private async processCryptoReceivedTransaction(tx: TreasuryTransaction): Promise<void> {
    const now = Date.now();
    const timeSinceCryptoReceived = now - (tx.cryptoReceivedAt || 0);

    if (timeSinceCryptoReceived >= this.FIAT_PROCESSING_DELAY) {
      console.log(`💱 Converting crypto to fiat for transaction ${tx.id}`);
      
      tx.status = 'fiat_processing';
      
      // For crypto-to-naira, prepare Paystack transfer
      if (tx.type === 'crypto_to_naira') {
        await this.prepareBankTransfer(tx);
      } else {
        // For bill payments, prepare provider payment
        await this.prepareBillPayment(tx);
      }
      
      this.transactions.set(tx.id, tx);
      this.emitTransactionUpdate(tx);
    }
  }

  /**
   * Process a fiat processing transaction (execute payment)
   */
  private async processFiatProcessingTransaction(tx: TreasuryTransaction): Promise<void> {
    try {
      if (tx.type === 'crypto_to_naira') {
        await this.executeBankTransfer(tx);
      } else {
        await this.executeBillPayment(tx);
      }
    } catch (error: any) {
      console.error(`❌ Payment execution failed for ${tx.id}:`, error);
      
      tx.retryCount++;
      if (tx.retryCount >= tx.maxRetries) {
        tx.status = 'failed';
        tx.error = error.message;
        console.log(`💀 Transaction ${tx.id} failed after ${tx.maxRetries} retries`);
      } else {
        console.log(`🔄 Retrying transaction ${tx.id} (attempt ${tx.retryCount + 1}/${tx.maxRetries})`);
      }
      
      this.transactions.set(tx.id, tx);
      this.emitTransactionUpdate(tx);
    }
  }

  /**
   * Prepare bank transfer via Paystack
   */
  private async prepareBankTransfer(tx: TreasuryTransaction): Promise<void> {
    try {
      const { bankCode, accountNumber, accountName } = tx.recipientData;
      
      if (!bankCode || !accountNumber || !accountName) {
        throw new Error('Missing bank details');
      }

      // Create transfer recipient
      const recipient = await PaystackService.createTransferRecipient(
        accountNumber,
        bankCode,
        accountName
      );

      tx.paystackRecipientCode = recipient.recipient_code;
      
      console.log(`🏦 Created Paystack recipient for ${tx.id}: ${recipient.recipient_code}`);
      
    } catch (error: any) {
      console.error(`Failed to prepare bank transfer for ${tx.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute bank transfer via Paystack
   */
  private async executeBankTransfer(tx: TreasuryTransaction): Promise<void> {
    if (!tx.paystackRecipientCode) {
      throw new Error('No Paystack recipient code');
    }

    try {
      const reference = PaystackService.generateReference('CPPAY_CTN');
      const reason = tx.memo || `Crypto to Naira conversion - ${tx.id}`;
      
      // Calculate final amount (deduct fees)
      const finalAmount = tx.fiatAmount - tx.fees.paystackFee - tx.fees.cppayFee;
      
      console.log(`💸 Executing bank transfer for ${tx.id}: ₦${finalAmount}`);
      
      // Simulate Paystack transfer (in real implementation, this would call actual API)
      await new Promise(resolve => setTimeout(resolve, this.PAYMENT_EXECUTION_DELAY));
      
      // Mock successful transfer
      tx.paystackReference = reference;
      tx.status = 'fiat_sent';
      tx.fiatSentAt = Date.now();
      
      console.log(`✅ Bank transfer completed for ${tx.id}: ${reference}`);
      
      // Complete the transaction after a short delay
      setTimeout(() => {
        tx.status = 'completed';
        tx.completedAt = Date.now();
        this.transactions.set(tx.id, tx);
        this.emitTransactionUpdate(tx);
        
        console.log(`🎉 Transaction ${tx.id} completed successfully`);
      }, 15000); // 15 seconds to simulate bank processing
      
    } catch (error: any) {
      console.error(`Failed to execute bank transfer for ${tx.id}:`, error);
      throw error;
    }
  }

  /**
   * Prepare bill payment
   */
  private async prepareBillPayment(tx: TreasuryTransaction): Promise<void> {
    console.log(`📋 Preparing ${tx.type} payment for ${tx.id}`);
    // Mock preparation - in real implementation would integrate with bill payment providers
  }

  /**
   * Execute bill payment
   */
  private async executeBillPayment(tx: TreasuryTransaction): Promise<void> {
    console.log(`💳 Executing ${tx.type} payment for ${tx.id}: ₦${tx.fiatAmount}`);
    
    // Simulate bill payment processing
    await new Promise(resolve => setTimeout(resolve, this.PAYMENT_EXECUTION_DELAY));
    
    tx.status = 'fiat_sent';
    tx.fiatSentAt = Date.now();
    
    console.log(`✅ ${tx.type} payment completed for ${tx.id}`);
    
    // Complete the transaction
    setTimeout(() => {
      tx.status = 'completed';
      tx.completedAt = Date.now();
      this.transactions.set(tx.id, tx);
      this.emitTransactionUpdate(tx);
      
      console.log(`🎉 ${tx.type} transaction ${tx.id} completed successfully`);
    }, 10000); // 10 seconds for confirmation
  }

  /**
   * Emit transaction update event (for UI updates)
   */
  private emitTransactionUpdate(tx: TreasuryTransaction): void {
    // In a real app, this would use EventEmitter or similar
    console.log(`📡 Transaction update: ${tx.id} → ${tx.status}`);
  }

  /**
   * Helper methods
   */
  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private estimateNetworkFee(token: string): number {
    const fees = {
      ETH: 0.005,
      USDC: 0.01,
      USDT: 0.01,
      DAI: 0.015,
    };
    
    return fees[token as keyof typeof fees] || 0.01;
  }

  private async getPaystackFee(amount: number): Promise<number> {
    try {
      const feeInfo = await PaystackService.getTransferFees(amount);
      return feeInfo.fee;
    } catch (error) {
      // Fallback fee calculation
      return amount <= 5000 ? 10 : amount <= 50000 ? 25 : 50;
    }
  }

  /**
   * Get treasury statistics
   */
  getTreasuryStats() {
    const transactions = this.getAllTransactions();
    
    const stats = {
      totalTransactions: transactions.length,
      completedTransactions: transactions.filter(tx => tx.status === 'completed').length,
      pendingTransactions: transactions.filter(tx => tx.status !== 'completed' && tx.status !== 'failed').length,
      failedTransactions: transactions.filter(tx => tx.status === 'failed').length,
      totalVolume: transactions.reduce((sum, tx) => sum + tx.fiatAmount, 0),
      totalFees: transactions.reduce((sum, tx) => {
        return sum + tx.fees.cppayFee + tx.fees.conversionFee;
      }, 0),
      averageProcessingTime: this.calculateAverageProcessingTime(transactions),
    };

    return stats;
  }

  private calculateAverageProcessingTime(transactions: TreasuryTransaction[]): number {
    const completedTxs = transactions.filter(tx => tx.completedAt && tx.createdAt);
    
    if (completedTxs.length === 0) return 0;
    
    const totalTime = completedTxs.reduce((sum, tx) => {
      return sum + (tx.completedAt! - tx.createdAt);
    }, 0);
    
    return Math.round(totalTime / completedTxs.length / 1000); // Return in seconds
  }

  /**
   * Cleanup old transactions (for memory management)
   */
  cleanupOldTransactions(maxAge: number = 86400000): void { // 24 hours by default
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [id, tx] of this.transactions.entries()) {
      if (now - tx.createdAt > maxAge && (tx.status === 'completed' || tx.status === 'failed')) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.transactions.delete(id));
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old transactions`);
    }
  }
}

// Export singleton instance
const mockTreasuryService = new MockTreasuryService();
export default mockTreasuryService;