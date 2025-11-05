/**
 * Feature 1: Airtime Purchase Service
 * Complete implementation with proper types and error handling
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import { getNetworkName } from '../UserOpUtils';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type {
  PaymentEstimationResponse,
  AirtimePurchaseResponse,
} from '../../types/api';

export interface AirtimePurchaseParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  phoneNumber: string;
  amountNGN: number;
  provider: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  paymentToken: string;
}

export interface AirtimePurchaseResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  paymentId?: string;
  estimatedTime: number;
  error?: string;
}

class AirtimePurchaseService {
  /**
   * Purchase airtime using crypto
   * 
   * Flow:
   * 1. Estimate payment (convert NGN to token amount)
   * 2. Create UserOperation for token transfer
   * 3. Submit UserOperation to bundler
   * 4. Initiate airtime purchase on backend
   * 5. Wait for confirmation
   */
  static async purchaseAirtime(
    params: AirtimePurchaseParams
  ): Promise<AirtimePurchaseResult> {
    try {
      console.log('📱 Starting airtime purchase...', {
        phone: params.phoneNumber,
        amount: params.amountNGN,
        provider: params.provider,
        token: params.paymentToken,
      });

      // Step 1: Estimate payment cost
      console.log('💰 Step 1: Estimating payment cost...');
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'airtime',
        amount_ngn: params.amountNGN,
        from_token: params.paymentToken,
        network: 'lisk-sepolia',
      }) as PaymentEstimationResponse;

      console.log('✅ Estimation received:', {
        tokenAmount: estimation.token_amount,
        fees: estimation.total_fee_ngn,
        gasSponsored: estimation.gas_sponsored,
      });

      // Step 2: Determine token decimals
      const tokenDecimals = params.paymentToken === 'USDT' || params.paymentToken === 'USDC' ? 6 : 18;
      const tokenAmount = parseUnits(estimation.token_amount_with_fees, tokenDecimals);

      console.log('💎 Token amount to transfer:', {
        amount: estimation.token_amount_with_fees,
        decimals: tokenDecimals,
        wei: tokenAmount.toString(),
      });

      // Step 3: Get backend contract address (where tokens should be sent)
      const backendContractAddress = process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address || 
                                     '0x0000000000000000000000000000000000000000' as Address;

      // Step 4: Create UserOperation
      console.log('🔨 Step 2: Creating UserOperation...');
      let userOp;

      if (params.paymentToken === 'ETH' || params.paymentToken === 'BNB' || params.paymentToken === 'LISK') {
        // Native token transfer
        userOp = await AccountAbstractionService.createNativeTransferOp(
          params.smartWalletAddress,
          params.privateKey,
          backendContractAddress,
          tokenAmount
        );
      } else {
        // ERC-20 token transfer
        userOp = await AccountAbstractionService.createERC20TransferOp(
          params.smartWalletAddress,
          params.privateKey,
          estimation.token_address,
          backendContractAddress,
          tokenAmount
        );
      }

      console.log('✅ UserOperation created');

      // Step 5: Submit UserOperation to bundler
      console.log('📤 Step 3: Submitting UserOperation to bundler...');
      const userOpHash = await BundlerService.sendUserOperation(userOp);
      console.log('✅ UserOperation submitted:', userOpHash);

      // Step 6: Initiate airtime purchase on backend
      console.log('🔄 Step 4: Initiating airtime purchase on backend...');
      const payment = await BackendApiService.buyAirtime({
        phone_number: params.phoneNumber,
        amount_ngn: params.amountNGN,
        network: params.provider,
        from_token: params.paymentToken,
        blockchain_network: 'lisk-sepolia',
        transaction_hash: userOpHash,
      }) as AirtimePurchaseResponse;

      console.log('✅ Airtime purchase initiated:', payment.id);

      // Step 7: Wait for UserOperation confirmation (with timeout)
      console.log('⏳ Step 5: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ Airtime purchase completed successfully!', {
          txHash: status.transactionHash,
          paymentId: payment.id,
        });

        return {
          success: true,
          transactionHash: status.transactionHash,
          userOpHash,
          paymentId: payment.id,
          estimatedTime: 30,
        };
      } else {
        console.error('❌ Transaction failed:', status.error);
        return {
          success: false,
          userOpHash,
          estimatedTime: 0,
          error: status.error || 'Transaction failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Airtime purchase failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get airtime purchase status
   */
  static async getPurchaseStatus(paymentId: string): Promise<AirtimePurchaseResponse> {
    try {
      const status = await BackendApiService.getPaymentStatus(paymentId) as AirtimePurchaseResponse;
      return status;
    } catch (error: any) {
      throw new Error(`Failed to get purchase status: ${error.message}`);
    }
  }
}

export default AirtimePurchaseService;
