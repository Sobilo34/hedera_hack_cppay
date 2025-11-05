/**
 * Feature 7: Cash Withdrawal Service
 * Withdraw cash at merchant locations
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type { PaymentEstimationResponse } from '../../types/api';

export interface CashWithdrawalParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  amountNGN: number;
  paymentToken: string;
  merchantId?: string; // Optional: specific merchant
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface CashWithdrawalResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  withdrawalCode?: string; // 6-digit code for merchant
  withdrawalId?: string;
  expiresAt?: number; // Timestamp when code expires
  estimatedTime: number;
  error?: string;
}

export interface Merchant {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number; // Distance in km
  rating: number;
  isAvailable: boolean;
  maxWithdrawalAmount: number;
}

class CashWithdrawalService {
  /**
   * Initiate cash withdrawal
   * 
   * Flow:
   * 1. Estimate payment cost
   * 2. Create UserOperation to lock funds
   * 3. Submit to bundler
   * 4. Generate withdrawal code
   * 5. User shows code to merchant
   * 6. Merchant releases cash and confirms
   */
  static async initiateWithdrawal(
    params: CashWithdrawalParams
  ): Promise<CashWithdrawalResult> {
    try {
      console.log('💵 Starting cash withdrawal...', {
        amount: params.amountNGN,
        token: params.paymentToken,
      });

      // Step 1: Validate withdrawal amount
      const limits = await this.getWithdrawalLimits(params.smartWalletAddress);
      
      if (params.amountNGN > limits.maxPerTransaction) {
        return {
          success: false,
          estimatedTime: 0,
          error: `Amount exceeds limit: ₦${limits.maxPerTransaction.toLocaleString()}`,
        };
      }

      if (params.amountNGN > limits.remainingToday) {
        return {
          success: false,
          estimatedTime: 0,
          error: `Daily limit exceeded. Remaining: ₦${limits.remainingToday.toLocaleString()}`,
        };
      }

      // Step 2: Estimate payment cost
      console.log('💰 Step 1: Estimating payment cost...');
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'withdrawal',
        amount_ngn: params.amountNGN,
        from_token: params.paymentToken,
        network: 'lisk-sepolia',
      }) as PaymentEstimationResponse;

      console.log('✅ Estimation received');

      // Step 3: Determine token decimals
      const tokenDecimals = params.paymentToken === 'USDT' || params.paymentToken === 'USDC' ? 6 : 18;
      const tokenAmount = parseUnits(estimation.token_amount_with_fees, tokenDecimals);

      // Step 4: Get backend contract address (escrow)
      const backendContractAddress = process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address || 
                                     '0x0000000000000000000000000000000000000000' as Address;

      // Step 5: Create UserOperation to lock funds
      console.log('🔨 Step 2: Creating UserOperation to lock funds...');
      let userOp;

      if (params.paymentToken === 'ETH' || params.paymentToken === 'BNB' || params.paymentToken === 'LISK') {
        userOp = await AccountAbstractionService.createNativeTransferOp(
          params.smartWalletAddress,
          params.privateKey,
          backendContractAddress,
          tokenAmount
        );
      } else {
        userOp = await AccountAbstractionService.createERC20TransferOp(
          params.smartWalletAddress,
          params.privateKey,
          estimation.token_address,
          backendContractAddress,
          tokenAmount
        );
      }

      console.log('✅ UserOperation created');

      // Step 6: Submit UserOperation to bundler
      console.log('📤 Step 3: Submitting UserOperation to bundler...');
      const userOpHash = await BundlerService.sendUserOperation(userOp);
      console.log('✅ UserOperation submitted:', userOpHash);

      // Step 7: Wait for confirmation
      console.log('⏳ Step 4: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status !== 'included') {
        return {
          success: false,
          userOpHash,
          estimatedTime: 0,
          error: status.error || 'Transaction failed',
        };
      }

      // Step 8: Generate withdrawal code on backend
      console.log('🎫 Step 5: Generating withdrawal code...');
      const withdrawal = await this.createWithdrawalCode(
        params.smartWalletAddress,
        params.amountNGN,
        params.paymentToken,
        userOpHash,
        params.merchantId
      );

      console.log('✅ Cash withdrawal initiated!', {
        code: withdrawal.code,
        expiresAt: withdrawal.expiresAt,
      });

      return {
        success: true,
        transactionHash: status.transactionHash,
        userOpHash,
        withdrawalCode: withdrawal.code,
        withdrawalId: withdrawal.id,
        expiresAt: withdrawal.expiresAt,
        estimatedTime: 0, // Code is ready immediately
      };
    } catch (error: any) {
      console.error('❌ Cash withdrawal failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Create withdrawal code on backend
   */
  private static async createWithdrawalCode(
    walletAddress: Address,
    amountNGN: number,
    token: string,
    transactionHash: Hex,
    merchantId?: string
  ): Promise<{
    id: string;
    code: string;
    expiresAt: number;
  }> {
    // This would call backend API to create withdrawal
    // For now, return mock data
    const code = this.generateWithdrawalCode();
    const expiresAt = Date.now() + 3600000; // 1 hour from now

    return {
      id: `withdrawal_${Date.now()}`,
      code,
      expiresAt,
    };
  }

  /**
   * Generate 6-digit withdrawal code
   */
  private static generateWithdrawalCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Find nearby merchants
   */
  static async findNearbyMerchants(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<Merchant[]> {
    // Mock data - in production, this would call backend API
    return [
      {
        id: 'merchant1',
        name: 'QuickCash Point - Ikeja',
        address: '23 Allen Avenue, Ikeja, Lagos',
        location: { latitude: 6.6018, longitude: 3.3515 },
        distance: 1.2,
        rating: 4.5,
        isAvailable: true,
        maxWithdrawalAmount: 500000,
      },
      {
        id: 'merchant2',
        name: 'FastCash Agent - VI',
        address: '45 Adeola Odeku Street, Victoria Island, Lagos',
        location: { latitude: 6.4281, longitude: 3.4219 },
        distance: 3.5,
        rating: 4.8,
        isAvailable: true,
        maxWithdrawalAmount: 1000000,
      },
      {
        id: 'merchant3',
        name: 'CPPay Merchant - Lekki',
        address: '12 Admiralty Way, Lekki Phase 1, Lagos',
        location: { latitude: 6.4474, longitude: 3.4705 },
        distance: 5.0,
        rating: 4.2,
        isAvailable: false,
        maxWithdrawalAmount: 300000,
      },
    ];
  }

  /**
   * Get withdrawal limits based on KYC tier
   */
  static async getWithdrawalLimits(walletAddress: Address): Promise<{
    tier: number;
    maxPerTransaction: number;
    maxDaily: number;
    maxMonthly: number;
    remainingToday: number;
    remainingMonth: number;
  }> {
    try {
      const limits = await BackendApiService.getTransactionLimits() as any;
      
      return {
        tier: limits.tier || 1,
        maxPerTransaction: limits.per_transaction_limit_ngn || 50000,
        maxDaily: limits.daily_limit_ngn || 50000,
        maxMonthly: limits.monthly_limit_ngn || 300000,
        remainingToday: limits.remaining_today_ngn || 50000,
        remainingMonth: limits.remaining_this_month_ngn || 300000,
      };
    } catch (error) {
      // Default limits for Tier 1 (unverified)
      return {
        tier: 1,
        maxPerTransaction: 50000,
        maxDaily: 50000,
        maxMonthly: 300000,
        remainingToday: 50000,
        remainingMonth: 300000,
      };
    }
  }

  /**
   * Get withdrawal status
   */
  static async getWithdrawalStatus(withdrawalId: string): Promise<{
    status: 'pending' | 'collected' | 'expired' | 'cancelled';
    code: string;
    amountNGN: number;
    expiresAt: number;
    collectedAt?: number;
    merchantName?: string;
  }> {
    // Mock data - in production, call backend API
    return {
      status: 'pending',
      code: '123456',
      amountNGN: 10000,
      expiresAt: Date.now() + 3600000,
    };
  }

  /**
   * Cancel withdrawal
   */
  static async cancelWithdrawal(
    withdrawalId: string,
    walletAddress: Address
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would call backend API to cancel and refund
      console.log('Cancelling withdrawal:', withdrawalId);
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default CashWithdrawalService;
