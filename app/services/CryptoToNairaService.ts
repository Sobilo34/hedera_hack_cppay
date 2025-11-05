/**
 * Crypto-to-Naira Transaction Service
 * 
 * Complete end-to-end flow for converting crypto to naira and sending to bank account:
 * 
 * Flow:
 * 1. User initiates transaction with desired naira amount
 * 2. System calculates crypto needed (amount + gas fees)
 * 3. User signs transaction via Account Abstraction
 * 4. Smart contract swaps crypto to USDC if needed
 * 5. Backend receives settlement via Paystack/payment gateway
 * 6. Naira transferred to recipient bank account
 * 7. Transaction confirmed and settled
 */

import BackendApiService from './BackendApiService';
import SmartAccountService from './SmartAccountService';
import { Decimal } from 'decimal.js';

export enum TransactionStage {
  INITIATED = 'initiated',                    // User starts transaction
  CRYPTO_CALCULATED = 'crypto_calculated',    // System calculated crypto needed
  SIGNING = 'signing',                        // Waiting for user signature
  SWAP_INITIATED = 'swap_initiated',          // Swap sent to blockchain
  SWAP_CONFIRMED = 'swap_confirmed',          // Swap confirmed on chain
  SETTLEMENT_PROCESSING = 'settlement_processing', // Waiting for backend payment
  SETTLEMENT_PENDING = 'settlement_pending',  // Payment submitted to Paystack
  BANK_TRANSFER_INITIATED = 'bank_transfer_initiated', // Bank transfer started
  COMPLETED = 'completed',                    // Fully settled
  FAILED = 'failed',                          // Transaction failed
  CANCELLED = 'cancelled',                    // User cancelled
}

export interface CryptoToNairaRequest {
  // Crypto details
  cryptoToken: string;                        // Token user wants to send (ETH, USDC, etc)
  cryptoAmount?: number;                      // Optional: specific crypto amount
  
  // Fiat details
  nairaAmount: number;                        // NGN amount user wants to send
  
  // Recipient bank details
  recipientBankCode: string;                  // Bank code (e.g., '011' for First Bank)
  recipientAccountNumber: string;             // Bank account number
  recipientAccountName: string;               // Account holder name
  
  // Network
  chainId: number;                            // Blockchain chain ID
  
  // Optional
  memo?: string;                              // Transaction memo/note
}

export interface TransactionProgress {
  stage: TransactionStage;
  progress: number;                           // 0-100 percentage
  timestamp: number;
  message: string;
  details?: Record<string, any>;
}

export interface TransactionResult {
  transactionId: string;
  userOperationHash?: string;
  status: TransactionStage;
  cryptoAmount: number;
  nairaAmount: number;
  exchangeRate: number;
  gasFee: number;
  totalCryptoNeeded: number;
  bankTransferReference?: string;
  estimatedSettlementTime: number;           // Estimated time in minutes
  createdAt: number;
  completedAt?: number;
}

class CryptoToNairaService {
  private backendApi = BackendApiService;
  private smartAccountService: SmartAccountService;
  private transactionProgress: Map<string, TransactionProgress[]> = new Map();

  constructor(chainId: number) {
    this.smartAccountService = new SmartAccountService(chainId);
  }

  /**
   * Initiate crypto-to-naira transaction
   */
  async initiateTransaction(request: CryptoToNairaRequest): Promise<TransactionResult> {
    const transactionId = this.generateTransactionId();
    
    try {
      // Stage 1: Initiate
      this.recordProgress(transactionId, {
        stage: TransactionStage.INITIATED,
        progress: 5,
        message: 'Transaction initiated',
        details: { request }
      });

      // Validate bank account
      await this.validateBankAccount(request.recipientBankCode, request.recipientAccountNumber);
      
      // Stage 2: Calculate crypto needed
      this.recordProgress(transactionId, {
        stage: TransactionStage.CRYPTO_CALCULATED,
        progress: 15,
        message: 'Calculating crypto needed...'
      });

      const calculation = await this.calculateCryptoNeeded(request);
      
      this.recordProgress(transactionId, {
        stage: TransactionStage.CRYPTO_CALCULATED,
        progress: 25,
        message: 'Crypto amount calculated',
        details: calculation
      });

      // Create backend transaction record
      const backendTx = await this.backendApi.createCryptoToNairaTransaction({
        transactionId,
        cryptoToken: request.cryptoToken,
        cryptoAmount: calculation.totalCryptoNeeded,
        nairaAmount: request.nairaAmount,
        exchangeRate: calculation.exchangeRate,
        gasFee: calculation.gasFee,
        chainId: request.chainId,
        bankDetails: {
          bankCode: request.recipientBankCode,
          accountNumber: request.recipientAccountNumber,
          accountName: request.recipientAccountName,
        }
      });

      return {
        transactionId,
        status: TransactionStage.CRYPTO_CALCULATED,
        cryptoAmount: calculation.cryptoAmount,
        nairaAmount: request.nairaAmount,
        exchangeRate: calculation.exchangeRate,
        gasFee: calculation.gasFee,
        totalCryptoNeeded: calculation.totalCryptoNeeded,
        estimatedSettlementTime: 5, // 5 minutes estimate
        createdAt: Date.now(),
      };

    } catch (error) {
      console.error('❌ Failed to initiate transaction:', error);
      this.recordProgress(transactionId, {
        stage: TransactionStage.FAILED,
        progress: 100,
        message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Sign and submit UserOperation for crypto swap
   */
  async signAndExecuteSwap(
    transactionId: string,
    userPrivateKey: string,
    request: CryptoToNairaRequest
  ): Promise<{ userOperationHash: string; swapData: any }> {
    try {
      // Stage 3: Signing
      this.recordProgress(transactionId, {
        stage: TransactionStage.SIGNING,
        progress: 30,
        message: 'Waiting for transaction signature...'
      });

      // Get user's smart account address
      const smartAccountAddress = await this.smartAccountService.getSmartAccountAddress(userPrivateKey);

      // Calculate crypto needed
      const calculation = await this.calculateCryptoNeeded(request);

      // Build swap call data for smart contract
      const swapCallData = await this.buildSwapCallData(
        smartAccountAddress,
        request.cryptoToken,
        calculation.cryptoAmount,
        'USDC' // Swap to USDC (stablecoin)
      );

      // Stage 4: Create UserOperation
      this.recordProgress(transactionId, {
        stage: TransactionStage.SIGNING,
        progress: 40,
        message: 'Signing transaction...'
      });

      // Call backend to create UserOperation
      const userOpData = await this.backendApi.createUserOperation({
        transactionId,
        senderAddress: smartAccountAddress,
        callData: swapCallData,
        chainId: request.chainId,
      });

      // Stage 5: Sign UserOperation
      const signedUserOp = await this.signUserOperation(
        userOpData,
        userPrivateKey
      );

      // Stage 6: Submit to bundler via backend
      this.recordProgress(transactionId, {
        stage: TransactionStage.SWAP_INITIATED,
        progress: 50,
        message: 'Submitting swap transaction...'
      });

      const submissionResult = await this.backendApi.submitUserOperation({
        transactionId,
        userOperation: signedUserOp,
        chainId: request.chainId,
      });

      const userOperationHash = submissionResult.userOperationHash;

      this.recordProgress(transactionId, {
        stage: TransactionStage.SWAP_INITIATED,
        progress: 60,
        message: 'Swap transaction submitted',
        details: { userOperationHash }
      });

      return {
        userOperationHash,
        swapData: {
          cryptoToken: request.cryptoToken,
          cryptoAmount: calculation.cryptoAmount,
          outputToken: 'USDC',
          expectedOutput: calculation.nairaAmount / calculation.exchangeRate,
        }
      };

    } catch (error) {
      console.error('❌ Failed to sign and execute swap:', error);
      this.recordProgress(transactionId, {
        stage: TransactionStage.FAILED,
        progress: 100,
        message: `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Monitor swap confirmation and initiate settlement
   */
  async waitForSwapConfirmation(
    transactionId: string,
    userOperationHash: string,
    request: CryptoToNairaRequest,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Poll for UserOperation confirmation
      const pollInterval = 10000; // 10 seconds
      let confirmed = false;

      while (!confirmed && (Date.now() - startTime) < maxWaitTime) {
        this.recordProgress(transactionId, {
          stage: TransactionStage.SWAP_CONFIRMED,
          progress: 65,
          message: 'Waiting for swap confirmation...',
          details: { userOperationHash }
        });

        const status = await this.backendApi.getUserOperationStatus(
          userOperationHash,
          request.chainId
        );

        if (status.confirmed) {
          confirmed = true;
          this.recordProgress(transactionId, {
            stage: TransactionStage.SWAP_CONFIRMED,
            progress: 75,
            message: 'Swap confirmed on blockchain',
            details: { transactionHash: status.transactionHash }
          });
          break;
        }

        await this.delay(pollInterval);
      }

      if (!confirmed) {
        throw new Error('Swap confirmation timeout - transaction may have failed');
      }

      // Initiate settlement
      await this.initiateSettlement(transactionId, request);

    } catch (error) {
      console.error('❌ Swap confirmation failed:', error);
      this.recordProgress(transactionId, {
        stage: TransactionStage.FAILED,
        progress: 100,
        message: `Confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Initiate fiat settlement (Paystack payment)
   */
  private async initiateSettlement(
    transactionId: string,
    request: CryptoToNairaRequest
  ): Promise<void> {
    try {
      this.recordProgress(transactionId, {
        stage: TransactionStage.SETTLEMENT_PROCESSING,
        progress: 80,
        message: 'Processing settlement...'
      });

      // Call backend to process payment via Paystack
      const settlementData = await this.backendApi.initiatePaystackTransfer({
        transactionId,
        nairaAmount: request.nairaAmount,
        recipientBankCode: request.recipientBankCode,
        recipientAccountNumber: request.recipientAccountNumber,
        recipientAccountName: request.recipientAccountName,
        memo: request.memo,
      });

      this.recordProgress(transactionId, {
        stage: TransactionStage.SETTLEMENT_PENDING,
        progress: 85,
        message: 'Settlement submitted to payment gateway',
        details: {
          paystackReference: settlementData.reference
        }
      });

      // Monitor settlement status
      await this.monitorSettlement(transactionId, settlementData.reference);

    } catch (error) {
      console.error('❌ Settlement initiation failed:', error);
      this.recordProgress(transactionId, {
        stage: TransactionStage.FAILED,
        progress: 100,
        message: `Settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Monitor payment settlement status
   */
  private async monitorSettlement(
    transactionId: string,
    paystackReference: string,
    maxWaitTime: number = 120000 // 2 minutes
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const pollInterval = 5000; // 5 seconds
      let settled = false;

      while (!settled && (Date.now() - startTime) < maxWaitTime) {
        this.recordProgress(transactionId, {
          stage: TransactionStage.BANK_TRANSFER_INITIATED,
          progress: 90,
          message: 'Processing bank transfer...',
          details: { paystackReference }
        });

        const status = await this.backendApi.getPaystackTransferStatus(paystackReference);

        if (status.successful || status.status === 'success') {
          settled = true;
          this.recordProgress(transactionId, {
            stage: TransactionStage.COMPLETED,
            progress: 100,
            message: 'Transaction completed successfully',
            details: {
              bankTransferReference: status.reference,
              bankTransferStatus: status.status,
            }
          });
          
          // Mark transaction as completed in backend
          await this.backendApi.completeTransaction(transactionId);
          break;
        }

        if (status.failed || status.status === 'failed') {
          throw new Error(`Bank transfer failed: ${status.reason || 'Unknown reason'}`);
        }

        await this.delay(pollInterval);
      }

      if (!settled) {
        throw new Error('Settlement timeout - please check payment status');
      }

    } catch (error) {
      console.error('❌ Settlement monitoring failed:', error);
      this.recordProgress(transactionId, {
        stage: TransactionStage.FAILED,
        progress: 100,
        message: `Settlement monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  /**
   * Get transaction progress
   */
  getTransactionProgress(transactionId: string): TransactionProgress[] {
    return this.transactionProgress.get(transactionId) || [];
  }

  /**
   * Get current transaction stage
   */
  getCurrentStage(transactionId: string): TransactionStage | null {
    const progress = this.getTransactionProgress(transactionId);
    return progress.length > 0 ? progress[progress.length - 1].stage : null;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate bank account exists and is correct
   */
  private async validateBankAccount(bankCode: string, accountNumber: string): Promise<void> {
    try {
      const isValid = await this.backendApi.validateBankAccount(bankCode, accountNumber);
      if (!isValid) {
        throw new Error('Invalid bank account details');
      }
    } catch (error) {
      throw new Error(`Bank validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate crypto needed for fiat amount
   */
  private async calculateCryptoNeeded(request: CryptoToNairaRequest): Promise<{
    cryptoAmount: number;
    totalCryptoNeeded: number;
    gasFee: number;
    exchangeRate: number;
  }> {
    try {
      const result = await this.backendApi.calculateCryptoNeeded({
        cryptoToken: request.cryptoToken,
        nairaAmount: request.nairaAmount,
        chainId: request.chainId,
      });

      return {
        cryptoAmount: result.cryptoAmount,
        totalCryptoNeeded: result.totalCryptoNeeded,
        gasFee: result.gasFee,
        exchangeRate: result.exchangeRate,
      };
    } catch (error) {
      throw new Error(`Failed to calculate crypto needed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build swap call data for smart contract
   */
  private async buildSwapCallData(
    smartAccountAddress: string,
    tokenIn: string,
    amountIn: number,
    tokenOut: string
  ): Promise<string> {
    // This will call backend API to get proper call data for swap
    const callData = await this.backendApi.buildSwapCallData({
      smartAccountAddress,
      tokenIn,
      amountIn,
      tokenOut,
    });

    return callData;
  }

  /**
   * Sign UserOperation with private key
   */
  private async signUserOperation(userOp: any, privateKey: string): Promise<any> {
    try {
      // Use Account Abstraction signing
      const signedUserOp = await this.smartAccountService.signUserOperation(
        userOp,
        privateKey
      );
      return signedUserOp;
    } catch (error) {
      throw new Error(`Failed to sign UserOperation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record transaction progress
   */
  private recordProgress(transactionId: string, progress: Omit<TransactionProgress, 'timestamp'>): void {
    const progressEntry: TransactionProgress = {
      ...progress,
      timestamp: Date.now(),
    };

    if (!this.transactionProgress.has(transactionId)) {
      this.transactionProgress.set(transactionId, []);
    }

    this.transactionProgress.get(transactionId)!.push(progressEntry);
    console.log(`[${transactionId}] Stage: ${progress.stage} (${progress.progress}%) - ${progress.message}`);
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CryptoToNairaService;