/**
 * Feature 2: Data Purchase Service
 * Complete implementation for buying mobile data bundles
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type {
  PaymentEstimationResponse,
  DataPurchaseResponse,
} from '../../types/api';

export interface DataPurchaseParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  phoneNumber: string;
  amountNGN: number;
  provider: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  dataCode: string; // Provider-specific data bundle code
  paymentToken: string;
}

export interface DataPurchaseResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  paymentId?: string;
  estimatedTime: number;
  error?: string;
}

class DataPurchaseService {
  /**
   * Purchase mobile data using crypto
   * 
   * Flow:
   * 1. Estimate payment (convert NGN to token amount)
   * 2. Create UserOperation for token transfer
   * 3. Submit UserOperation to bundler
   * 4. Initiate data purchase on backend
   * 5. Wait for confirmation
   */
  static async purchaseData(
    params: DataPurchaseParams
  ): Promise<DataPurchaseResult> {
    try {
      console.log('📶 Starting data purchase...', {
        phone: params.phoneNumber,
        amount: params.amountNGN,
        provider: params.provider,
        dataCode: params.dataCode,
        token: params.paymentToken,
      });

      // Step 1: Estimate payment cost
      console.log('💰 Step 1: Estimating payment cost...');
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'data',
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

      // Step 3: Get backend contract address
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

      // Step 6: Initiate data purchase on backend
      console.log('🔄 Step 4: Initiating data purchase on backend...');
      const payment = await BackendApiService.buyData({
        phone_number: params.phoneNumber,
        amount_ngn: params.amountNGN,
        data_code: params.dataCode,
        network: params.provider,
        from_token: params.paymentToken,
        blockchain_network: 'lisk-sepolia',
        transaction_hash: userOpHash,
      }) as DataPurchaseResponse;

      console.log('✅ Data purchase initiated:', payment.id);

      // Step 7: Wait for UserOperation confirmation
      console.log('⏳ Step 5: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ Data purchase completed successfully!', {
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
      console.error('❌ Data purchase failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get data purchase status
   */
  static async getPurchaseStatus(paymentId: string): Promise<DataPurchaseResponse> {
    try {
      const status = await BackendApiService.getPaymentStatus(paymentId) as DataPurchaseResponse;
      return status;
    } catch (error: any) {
      throw new Error(`Failed to get purchase status: ${error.message}`);
    }
  }

  /**
   * Get available data bundles for a provider
   * Returns common data bundle codes
   */
  static getDataBundles(provider: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'): {
    code: string;
    name: string;
    price: number;
    validity: string;
  }[] {
    const bundles: Record<string, any[]> = {
      MTN: [
        { code: 'MTN-1GB-DAY', name: '1GB Daily', price: 350, validity: '1 day' },
        { code: 'MTN-2GB-WEEK', name: '2GB Weekly', price: 700, validity: '7 days' },
        { code: 'MTN-5GB-MONTH', name: '5GB Monthly', price: 1500, validity: '30 days' },
        { code: 'MTN-10GB-MONTH', name: '10GB Monthly', price: 2500, validity: '30 days' },
      ],
      GLO: [
        { code: 'GLO-1.6GB-WEEK', name: '1.6GB Weekly', price: 500, validity: '7 days' },
        { code: 'GLO-3.9GB-WEEK', name: '3.9GB Weekly', price: 1000, validity: '7 days' },
        { code: 'GLO-7.5GB-MONTH', name: '7.5GB Monthly', price: 1500, validity: '30 days' },
        { code: 'GLO-15GB-MONTH', name: '15GB Monthly', price: 2500, validity: '30 days' },
      ],
      AIRTEL: [
        { code: 'AIRTEL-1.5GB-MONTH', name: '1.5GB Monthly', price: 1000, validity: '30 days' },
        { code: 'AIRTEL-3GB-MONTH', name: '3GB Monthly', price: 1500, validity: '30 days' },
        { code: 'AIRTEL-6GB-MONTH', name: '6GB Monthly', price: 2000, validity: '30 days' },
        { code: 'AIRTEL-10GB-MONTH', name: '10GB Monthly', price: 2500, validity: '30 days' },
      ],
      '9MOBILE': [
        { code: '9MOBILE-1.5GB-MONTH', name: '1.5GB Monthly', price: 1000, validity: '30 days' },
        { code: '9MOBILE-4.5GB-MONTH', name: '4.5GB Monthly', price: 2000, validity: '30 days' },
        { code: '9MOBILE-11GB-MONTH', name: '11GB Monthly', price: 4000, validity: '30 days' },
        { code: '9MOBILE-15GB-MONTH', name: '15GB Monthly', price: 5000, validity: '30 days' },
      ],
    };

    return bundles[provider] || [];
  }
}

export default DataPurchaseService;
