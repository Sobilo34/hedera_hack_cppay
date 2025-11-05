/**
 * Feature 4: Bank Transfer Service (NGN to Bank)
 * Transfer crypto converted to NGN directly to Nigerian bank account
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type {
  PaymentEstimationResponse,
  BankTransferResponse,
} from '../../types/api';

export interface BankTransferParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amountNGN: number;
  paymentToken: string;
}

export interface BankTransferResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  paymentId?: string;
  estimatedTime: number;
  error?: string;
}

export interface BankAccountVerificationResult {
  success: boolean;
  accountName: string;
  accountNumber: string;
  bankCode: string;
}

class BankTransferService {
  /**
   * Resolve account number against backend (Flutterwave) API
   */
  static async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<BankAccountVerificationResult> {
    try {
      const response = await BackendApiService.verifyBankAccount(
        accountNumber,
        bankCode
      ) as {
        valid?: boolean;
        account_name?: string;
        detail?: string;
        message?: string;
      };

      if (!response?.valid || !response.account_name) {
        throw new Error(response?.detail || response?.message || 'Account verification failed');
      }

      return {
        success: true,
        accountName: response.account_name,
        accountNumber,
        bankCode,
      };
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to verify bank account');
    }
  }

  /**
   * Transfer to Nigerian bank account using crypto
   * 
   * Flow:
   * 1. Estimate payment (convert NGN to token amount)
   * 2. Create UserOperation for token transfer to backend
   * 3. Submit UserOperation to bundler
   * 4. Initiate bank transfer via Flutterwave
   * 5. Wait for confirmation
   * 6. Funds arrive in recipient's bank account
   */
  static async transferToBank(
    params: BankTransferParams
  ): Promise<BankTransferResult> {
    try {
      console.log('🏦 Starting bank transfer...', {
        accountNumber: params.accountNumber,
        accountName: params.accountName,
        amount: params.amountNGN,
        token: params.paymentToken,
      });

      // Step 1: Estimate payment cost
      console.log('💰 Step 1: Estimating payment cost...');
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'bank_transfer',
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

      // Step 6: Initiate bank transfer on backend (Flutterwave)
      console.log('🔄 Step 4: Initiating bank transfer via Flutterwave...');
      const payment = await BackendApiService.bankTransfer({
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        amount_ngn: params.amountNGN,
        narration: `Transfer to ${params.accountName}`,
        from_token: params.paymentToken,
        blockchain_network: 'lisk-sepolia',
        transaction_hash: userOpHash,
      }) as BankTransferResponse;

      console.log('✅ Bank transfer initiated:', payment.id);

      // Step 7: Wait for UserOperation confirmation
      console.log('⏳ Step 5: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ Bank transfer completed successfully!', {
          txHash: status.transactionHash,
          paymentId: payment.id,
        });

        return {
          success: true,
          transactionHash: status.transactionHash,
          userOpHash,
          paymentId: payment.id,
          estimatedTime: 120, // Bank transfers take 1-2 minutes
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
      console.error('❌ Bank transfer failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get bank transfer status
   */
  static async getTransferStatus(paymentId: string): Promise<BankTransferResponse> {
    try {
      const status = await BackendApiService.getPaymentStatus(paymentId) as BankTransferResponse;
      return status;
    } catch (error: any) {
      throw new Error(`Failed to get transfer status: ${error.message}`);
    }
  }

  /**
   * Get list of Nigerian banks
   * Returns major Nigerian banks with their codes
   */
  static getNigerianBanks(): { code: string; name: string }[] {
    return [
      { code: '044', name: 'Access Bank' },
      { code: '063', name: 'Access Bank (Diamond)' },
      { code: '050', name: 'Ecobank Nigeria' },
      { code: '070', name: 'Fidelity Bank' },
      { code: '011', name: 'First Bank of Nigeria' },
      { code: '214', name: 'First City Monument Bank' },
      { code: '058', name: 'Guaranty Trust Bank' },
      { code: '030', name: 'Heritage Bank' },
      { code: '301', name: 'Jaiz Bank' },
      { code: '082', name: 'Keystone Bank' },
      { code: '526', name: 'Parallex Bank' },
      { code: '076', name: 'Polaris Bank' },
      { code: '101', name: 'Providus Bank' },
      { code: '221', name: 'Stanbic IBTC Bank' },
      { code: '068', name: 'Standard Chartered Bank' },
      { code: '232', name: 'Sterling Bank' },
      { code: '100', name: 'Suntrust Bank' },
      { code: '032', name: 'Union Bank of Nigeria' },
      { code: '033', name: 'United Bank for Africa' },
      { code: '215', name: 'Unity Bank' },
      { code: '035', name: 'Wema Bank' },
      { code: '057', name: 'Zenith Bank' },
    ];
  }

  /**
   * Validate bank account number
   * Basic validation - backend will do full validation via Flutterwave
   */
  static validateAccountNumber(accountNumber: string): {
    valid: boolean;
    error?: string;
  } {
    // Nigerian account numbers are typically 10 digits
    if (!/^\d{10}$/.test(accountNumber)) {
      return {
        valid: false,
        error: 'Account number must be 10 digits',
      };
    }

    return { valid: true };
  }
}

export default BankTransferService;
