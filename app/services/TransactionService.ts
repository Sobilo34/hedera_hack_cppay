import {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  AirtimePurchase,
  ElectricityPurchase,
  CableTVPurchase,
  InternetPurchase,
  WaterPurchase,
  P2PTransfer,
  CryptoSend,
  EducationPayment,
  BatchTransaction,
  BatchTransactionItem,
  ScheduledTransaction,
  SessionKey,
  TransactionFees,
  PaymentToken,
  Beneficiary,
  SmartSuggestion,
  WalletSuggestion,
  TransactionHistory,
  TransactionFilter,
  GasSponsorshipPolicy,
} from '@/types/transaction';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, polygon } from 'viem/chains';
import SmartAccountService from './smartAccount/SmartAccountService';
import type { SmartAccountTransaction } from './smartAccount/types';

/**
 * TransactionService
 * Handles all transaction operations for CPPay
 * Integrates with ERC-4337 for account abstraction
 */
class TransactionService {
  // ============================================================================
  // BILL PAYMENTS
  // ============================================================================

  /**
   * Purchase airtime
   */
  static async purchaseAirtime(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    purchase: AirtimePurchase,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('📱 Purchasing airtime...', purchase);

      // Calculate fees
      const fees = await this.calculateFees(
        TransactionCategory.AIRTIME,
        purchase.amount,
        paymentToken
      );

      // Check gas sponsorship eligibility
      const gasPolicy = await this.checkGasSponsorship(walletAddress, purchase.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      // Convert NGN to token amount
      const tokenAmount = await this.convertNGNToToken(purchase.amount, paymentToken);

      // Create transaction object
      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.AIRTIME,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '', // Will be filled by store
        paymentToken,
        amount: purchase.amount,
        amountUSD: purchase.amountUSD || 0,
        tokenAmount,
        details: purchase,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      // Execute on-chain transaction (UserOperation)
      // TODO: Integrate with ERC-4337 bundler
      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Airtime purchase initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Airtime purchase failed:', error);
      throw error;
    }
  }

  /**
   * Pay electricity bill
   */
  static async payElectricity(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    purchase: ElectricityPurchase,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('💡 Paying electricity bill...', purchase);

      const fees = await this.calculateFees(
        TransactionCategory.ELECTRICITY,
        purchase.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, purchase.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(purchase.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.ELECTRICITY,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: purchase.amount,
        amountUSD: purchase.amount / 1600, // Using default rate
        tokenAmount,
        details: purchase,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Electricity payment initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Electricity payment failed:', error);
      throw error;
    }
  }

  /**
   * Pay cable TV subscription
   */
  static async payCableTV(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    purchase: CableTVPurchase,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('📺 Paying cable TV...', purchase);

      const fees = await this.calculateFees(
        TransactionCategory.CABLE_TV,
        purchase.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, purchase.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(purchase.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.CABLE_TV,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: purchase.amount,
        amountUSD: purchase.amount / 1600,
        tokenAmount,
        details: purchase,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Cable TV payment initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Cable TV payment failed:', error);
      throw error;
    }
  }

  /**
   * Pay internet subscription
   */
  static async payInternet(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    purchase: InternetPurchase,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('📡 Paying internet...', purchase);

      const fees = await this.calculateFees(
        TransactionCategory.INTERNET,
        purchase.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, purchase.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(purchase.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.INTERNET,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: purchase.amount,
        amountUSD: purchase.amount / 1600,
        tokenAmount,
        details: purchase,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Internet payment initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Internet payment failed:', error);
      throw error;
    }
  }

  /**
   * Pay water bill
   */
  static async payWater(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    purchase: WaterPurchase,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('💧 Paying water bill...', purchase);

      const fees = await this.calculateFees(
        TransactionCategory.WATER,
        purchase.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, purchase.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(purchase.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.WATER,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: purchase.amount,
        amountUSD: purchase.amount / 1600,
        tokenAmount,
        details: purchase,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Water payment initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Water payment failed:', error);
      throw error;
    }
  }

  /**
   * Pay education fees
   */
  static async payEducation(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    payment: EducationPayment,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('🎓 Paying education fees...', payment);

      const fees = await this.calculateFees(
        TransactionCategory.EDUCATION,
        payment.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, payment.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(payment.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.EDUCATION,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: payment.amount,
        amountUSD: payment.amount / 1600,
        tokenAmount,
        details: payment,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Education payment initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Education payment failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // P2P TRANSFERS
  // ============================================================================

  /**
   * Send money to another user (P2P)
   */
  static async sendP2P(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    transfer: P2PTransfer,
    paymentToken: PaymentToken,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('💸 Sending P2P transfer...', transfer);

      const fees = await this.calculateFees(
        TransactionCategory.P2P_TRANSFER,
        transfer.amount,
        paymentToken
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, transfer.amount);
      fees.isGasSponsored = gasPolicy.isEligible;

      const tokenAmount = await this.convertNGNToToken(transfer.amount, paymentToken);

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.P2P_TRANSFER,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken,
        amount: transfer.amount,
        amountUSD: transfer.amount / 1600,
        tokenAmount,
        details: transfer,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
        notes: transfer.message,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ P2P transfer initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ P2P transfer failed:', error);
      throw error;
    }
  }

  /**
   * Send cryptocurrency directly
   */
  static async sendCrypto(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    send: CryptoSend,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('🚀 Sending crypto...', send);

      const fees = await this.calculateFees(
        TransactionCategory.CRYPTO_SEND,
        send.amountNGN,
        send.token
      );

      const gasPolicy = await this.checkGasSponsorship(walletAddress, send.amountNGN);
      fees.isGasSponsored = gasPolicy.isEligible;

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        category: TransactionCategory.CRYPTO_SEND,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken: send.token,
        amount: send.amountNGN,
        amountUSD: send.amountUSD,
        tokenAmount: send.amount,
        details: send,
        fees,
        createdAt: Date.now(),
        sessionKeyId,
        notes: send.message,
      };

      const userOpHash = await this.executeUserOperation(
        walletAddress,
        privateKey,
        transaction,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Crypto send initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Crypto send failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Execute batch transactions (multiple payments in one signature)
   */
  static async executeBatchTransaction(
    walletId: string,
    walletAddress: string,
    privateKey: string,
    batch: Omit<BatchTransaction, 'id' | 'createdAt' | 'status'>,
    sessionKeyId?: string
  ): Promise<Transaction> {
    try {
      console.log('📦 Executing batch transaction...', batch);

      // Calculate total fees for all items
      let totalFees: TransactionFees = {
        serviceFee: 0,
        networkFee: 0,
        providerFee: 0,
        totalFees: 0,
        isGasSponsored: false,
      };

      for (const item of batch.items) {
        const itemFees = await this.calculateFees(
          item.category,
          item.amount,
          batch.paymentToken
        );
        totalFees.serviceFee += itemFees.serviceFee;
        totalFees.networkFee += itemFees.networkFee;
        totalFees.providerFee = (totalFees.providerFee || 0) + (itemFees.providerFee || 0);
      }

      totalFees.totalFees = totalFees.serviceFee + totalFees.networkFee + (totalFees.providerFee || 0);

      // Check gas sponsorship for batch
      const gasPolicy = await this.checkGasSponsorship(walletAddress, batch.totalAmount);
      totalFees.isGasSponsored = gasPolicy.isEligible;

      if (totalFees.isGasSponsored) {
        totalFees.networkFee = 0;
        totalFees.totalFees -= totalFees.networkFee;
      }

      const completeBatch: BatchTransaction = {
        ...batch,
        id: this.generateTransactionId(),
        createdAt: Date.now(),
        status: TransactionStatus.PENDING,
      };

      const transaction: Transaction = {
        id: completeBatch.id,
        category: TransactionCategory.BATCH,
        status: TransactionStatus.PENDING,
        walletId,
        walletAddress,
        walletName: '',
        paymentToken: batch.paymentToken,
        amount: batch.totalAmount,
        amountUSD: batch.totalAmountUSD,
        tokenAmount: await this.convertNGNToToken(batch.totalAmount, batch.paymentToken),
        details: completeBatch,
        fees: totalFees,
        createdAt: Date.now(),
        sessionKeyId,
      };

      // Execute batch UserOperation
      const userOpHash = await this.executeBatchUserOperation(
        walletAddress,
        privateKey,
        completeBatch,
        sessionKeyId
      );

      transaction.userOperationHash = userOpHash;
      transaction.status = TransactionStatus.PROCESSING;

      console.log('✅ Batch transaction initiated:', userOpHash);
      return transaction;
    } catch (error) {
      console.error('❌ Batch transaction failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // SCHEDULED & RECURRING PAYMENTS
  // ============================================================================

  /**
   * Schedule a transaction for later execution
   */
  static async scheduleTransaction(
    scheduled: Omit<ScheduledTransaction, 'id' | 'createdAt'>
  ): Promise<ScheduledTransaction> {
    try {
      console.log('⏰ Scheduling transaction...', scheduled);

      const scheduledTx: ScheduledTransaction = {
        ...scheduled,
        id: this.generateTransactionId(),
        createdAt: Date.now(),
      };

      // Store in local database (will be executed by background service)
      // TODO: Implement background scheduler

      console.log('✅ Transaction scheduled:', scheduledTx.id);
      return scheduledTx;
    } catch (error) {
      console.error('❌ Failed to schedule transaction:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled transaction
   */
  static async cancelScheduledTransaction(id: string): Promise<void> {
    try {
      console.log('🚫 Cancelling scheduled transaction:', id);
      // TODO: Remove from scheduler
      console.log('✅ Scheduled transaction cancelled');
    } catch (error) {
      console.error('❌ Failed to cancel scheduled transaction:', error);
      throw error;
    }
  }

  // ============================================================================
  // SESSION KEYS (Account Abstraction)
  // ============================================================================

  /**
   * Create session key for gasless multi-step flows
   */
  static async createSessionKey(
    walletAddress: string,
    permissions: SessionKey['permissions'],
    durationMinutes: number = 30
  ): Promise<SessionKey> {
    try {
      console.log('🔑 Creating session key...', permissions);

      const now = Date.now();
      const sessionKey: SessionKey = {
        id: this.generateTransactionId(),
        publicKey: '', // TODO: Generate session keypair
        walletId: walletAddress,
        permissions,
        startTime: now,
        expiryTime: now + durationMinutes * 60 * 1000,
        totalSpent: 0,
        transactionCount: 0,
        isActive: true,
        createdAt: now,
      };

      // TODO: Register session key on-chain via ERC-4337

      console.log('✅ Session key created:', sessionKey.id);
      return sessionKey;
    } catch (error) {
      console.error('❌ Failed to create session key:', error);
      throw error;
    }
  }

  /**
   * Revoke session key
   */
  static async revokeSessionKey(sessionKeyId: string): Promise<void> {
    try {
      console.log('🚫 Revoking session key:', sessionKeyId);
      // TODO: Revoke on-chain
      console.log('✅ Session key revoked');
    } catch (error) {
      console.error('❌ Failed to revoke session key:', error);
      throw error;
    }
  }

  // ============================================================================
  // BENEFICIARIES
  // ============================================================================

  /**
   * Save beneficiary for quick access
   */
  static async saveBeneficiary(beneficiary: Omit<Beneficiary, 'id' | 'createdAt'>): Promise<Beneficiary> {
    try {
      const saved: Beneficiary = {
        ...beneficiary,
        id: this.generateTransactionId(),
        createdAt: Date.now(),
      };

      // TODO: Store in local database

      console.log('✅ Beneficiary saved:', saved.id);
      return saved;
    } catch (error) {
      console.error('❌ Failed to save beneficiary:', error);
      throw error;
    }
  }

  // ============================================================================
  // SMART SUGGESTIONS
  // ============================================================================

  /**
   * Get smart suggestions based on transaction history
   */
  static async getSmartSuggestions(walletAddress: string): Promise<SmartSuggestion[]> {
    try {
      // TODO: Analyze transaction history and return suggestions
      const suggestions: SmartSuggestion[] = [
        {
          id: '1',
          type: 'recurring_bill',
          title: 'Schedule Recurring Airtime',
          description: 'You buy ₦500 MTN airtime every week. Want to automate it?',
          action: {
            type: 'schedule',
            data: { amount: 500, frequency: 'weekly' },
          },
          priority: 1,
        },
      ];

      return suggestions;
    } catch (error) {
      console.error('❌ Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get optimal wallet suggestions for a transaction
   */
  static async getWalletSuggestions(
    amount: number,
    category: TransactionCategory
  ): Promise<WalletSuggestion[]> {
    try {
      // TODO: Analyze all wallets and return best options
      return [];
    } catch (error) {
      console.error('❌ Failed to get wallet suggestions:', error);
      return [];
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate transaction fees
   */
  private static async calculateFees(
    category: TransactionCategory,
    amountNGN: number,
    token: PaymentToken
  ): Promise<TransactionFees> {
    // Service fee: 0.5% of transaction
    const serviceFee = amountNGN * 0.005;

    // Network fee: Estimated gas (will be sponsored if eligible)
    const networkFee = 5; // ₦5 (~$0.003)

    // Provider fee: Varies by category
    const providerFee = category === TransactionCategory.AIRTIME ? 0 : amountNGN * 0.01;

    return {
      serviceFee,
      networkFee,
      providerFee,
      totalFees: serviceFee + networkFee + (providerFee || 0),
      isGasSponsored: false, // Will be updated based on policy
    };
  }

  /**
   * Check if user is eligible for gas sponsorship
   */
  private static async checkGasSponsorship(
    walletAddress: string,
    amountNGN: number
  ): Promise<GasSponsorshipPolicy> {
    // Sponsor gas for transactions under $50 (₦80,000)
    const maxSponsoredAmount = 80000;

    return {
      isEligible: amountNGN <= maxSponsoredAmount,
      reason: amountNGN <= maxSponsoredAmount
        ? `Transaction under ₦${maxSponsoredAmount} limit`
        : `Transaction exceeds ₦${maxSponsoredAmount} limit`,
      maxSponsoredAmount,
      currentUsage: 0, // TODO: Track usage
      resetDate: Date.now() + 24 * 60 * 60 * 1000,
      conditions: ['Transaction under ₦80,000', 'Maximum 10 sponsored transactions per day'],
    };
  }

  /**
   * Convert NGN amount to token amount
   */
  private static async convertNGNToToken(amountNGN: number, token: PaymentToken): Promise<string> {
    // TODO: Get real-time price from price oracle
    const ngnToUSD = amountNGN / 1600;
    const tokenPrice = 1; // Assume 1 USDT = $1 for now

    const tokenAmount = ngnToUSD / tokenPrice;
    return parseUnits(tokenAmount.toFixed(token.decimals), token.decimals).toString();
  }

  /**
   * Execute UserOperation (ERC-4337)
   */
  private static async executeUserOperation(
    walletAddress: string,
    privateKey: string,
    transaction: Transaction,
    sessionKeyId?: string
  ): Promise<string> {
    try {
      console.log('🔄 Executing UserOperation via Smart Account...');

      // Determine chain ID from transaction
      const chainId = this.getChainIdFromTransaction(transaction);

      // Check if gas should be sponsored
      const sponsorGas = transaction.fees?.isGasSponsored || false;

      // Build smart account transaction
      const smartTx: SmartAccountTransaction = {
        to: this.getRecipientAddress(transaction),
        value: this.getTransactionValue(transaction),
        data: this.encodeTransactionData(transaction),
      };

      console.log('📤 Smart Account Transaction:', {
        to: smartTx.to,
        value: smartTx.value.toString(),
        chainId,
        sponsorGas,
      });

      // Send via SmartAccountService
      const userOpHash = await SmartAccountService.sendTransaction(
        privateKey as `0x${string}`,
        smartTx,
        chainId,
        sponsorGas
      );

      console.log('✅ UserOperation sent:', userOpHash);
      return userOpHash;
    } catch (error) {
      console.error('❌ UserOperation failed:', error);
      throw error;
    }
  }

  /**
   * Execute batch UserOperation
   */
  private static async executeBatchUserOperation(
    walletAddress: string,
    privateKey: string,
    batch: BatchTransaction,
    sessionKeyId?: string
  ): Promise<string> {
    try {
      console.log('🔄 Executing batch UserOperation via Smart Account...');

      // Determine chain ID (use first transaction's chain)
      const chainId = batch.items.length > 0
        ? this.getChainIdFromBatchItem(batch.items[0])
        : 1;

      // Build batch transactions
      const smartTxs: SmartAccountTransaction[] = batch.items.map((item: BatchTransactionItem) => ({
        to: this.getRecipientAddressFromBatchItem(item),
        value: this.getTransactionValueFromBatchItem(item, batch.paymentToken),
        data: this.encodeTransactionDataFromBatchItem(item),
      }));

      console.log(`📤 Batch UserOperation with ${smartTxs.length} transactions`);

      // Send batch via SmartAccountService
      // Note: Gas sponsorship is determined automatically by SmartAccountService
      const userOpHash = await SmartAccountService.sendBatchTransactions(
        privateKey as `0x${string}`,
        smartTxs,
        chainId
      );

      console.log('✅ Batch UserOperation sent:', userOpHash);
      return userOpHash;
    } catch (error) {
      console.error('❌ Batch UserOperation failed:', error);
      throw error;
    }
  }

  /**
   * Get chain ID from batch item
   */
  private static getChainIdFromBatchItem(item: BatchTransactionItem): number {
    // Default to Ethereum mainnet
    return 1;
  }

  /**
   * Get recipient address from batch item
   */
  private static getRecipientAddressFromBatchItem(item: BatchTransactionItem): `0x${string}` {
    const PAYMENT_PROCESSOR = '0x1111111111111111111111111111111111111111';
    
    if (item.category === TransactionCategory.P2P_TRANSFER) {
      const p2p = item.details as P2PTransfer;
      return p2p.recipientAddress as `0x${string}`;
    }
    
    if (item.category === TransactionCategory.CRYPTO_SEND) {
      const crypto = item.details as CryptoSend;
      return crypto.recipientAddress as `0x${string}`;
    }

    return PAYMENT_PROCESSOR as `0x${string}`;
  }

  /**
   * Get transaction value from batch item
   */
  private static getTransactionValueFromBatchItem(item: BatchTransactionItem, paymentToken: PaymentToken): bigint {
    // Convert amount to token units
    const tokenAmount = (item.amountUSD / 1).toFixed(paymentToken.decimals); // Simplified conversion
    return parseUnits(tokenAmount, paymentToken.decimals);
  }

  /**
   * Encode transaction data from batch item
   */
  private static encodeTransactionDataFromBatchItem(item: BatchTransactionItem): `0x${string}` {
    // For simple transfers, data is empty
    return '0x' as `0x${string}`;
  }

  /**
   * Get chain ID from transaction
   */
  private static getChainIdFromTransaction(transaction: Transaction): number {
    // Extract chain ID from payment token or default to Ethereum mainnet
    return transaction.paymentToken?.chainId || 1;
  }

  /**
   * Get recipient address from transaction
   */
  private static getRecipientAddress(transaction: Transaction): `0x${string}` {
    // For bill payments, use a payment processor contract
    // For P2P transfers, use the recipient address
    // For now, use a placeholder address
    const PAYMENT_PROCESSOR = '0x1111111111111111111111111111111111111111';
    
    if (transaction.category === TransactionCategory.P2P_TRANSFER) {
      const p2p = transaction.details as P2PTransfer;
      return p2p.recipientAddress as `0x${string}`;
    }
    
    if (transaction.category === TransactionCategory.CRYPTO_SEND) {
      const crypto = transaction.details as CryptoSend;
      return crypto.recipientAddress as `0x${string}`;
    }

    // For bill payments, use payment processor
    return PAYMENT_PROCESSOR as `0x${string}`;
  }

  /**
   * Get transaction value (in wei)
   */
  private static getTransactionValue(transaction: Transaction): bigint {
    // Convert token amount to wei
    return parseUnits(transaction.tokenAmount, transaction.paymentToken.decimals);
  }

  /**
   * Encode transaction data
   */
  private static encodeTransactionData(transaction: Transaction): `0x${string}` {
    // For simple transfers, data is empty
    // For contract calls, encode function call data here
    // TODO: Implement proper encoding based on transaction category
    return '0x' as `0x${string}`;
  }

  /**
   * Generate unique transaction ID
   */
  private static generateTransactionId(): string {
    return `CPP${Date.now()}${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
  }
}

export default TransactionService;
