/**
 * Feature 3: P2P Transfer Service (NGN to CPPay)
 * Transfer crypto converted to NGN value to another CPPay user
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type {
  PaymentEstimationResponse,
  P2PTransferResponse,
} from '../../types/api';

export interface P2PTransferParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  recipientAddress: Address; // Recipient's wallet address or phone
  amountNGN: number;
  paymentToken: string;
  message?: string;
}

export interface P2PTransferResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  paymentId?: string;
  estimatedTime: number;
  error?: string;
}

class P2PTransferService {
  /**
   * Send P2P transfer using crypto (shown as NGN to user)
   * 
   * Flow:
   * 1. Estimate payment (convert NGN to token amount)
   * 2. Create UserOperation for token transfer
   * 3. Submit UserOperation to bundler
   * 4. Initiate P2P transfer on backend
   * 5. Wait for confirmation
   * 6. Recipient receives tokens in their wallet
   */
  static async sendP2P(
    params: P2PTransferParams
  ): Promise<P2PTransferResult> {
    try {
      console.log('💸 Starting P2P transfer...', {
        recipient: params.recipientAddress,
        amount: params.amountNGN,
        token: params.paymentToken,
      });

      // Step 1: Estimate payment cost
      console.log('💰 Step 1: Estimating payment cost...');
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'p2p',
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

      // Step 3: Create UserOperation
      // For P2P, we send tokens directly to recipient's smart wallet
      console.log('🔨 Step 2: Creating UserOperation for direct transfer...');
      let userOp;

      if (params.paymentToken === 'ETH' || params.paymentToken === 'BNB' || params.paymentToken === 'LISK') {
        // Native token transfer
        userOp = await AccountAbstractionService.createNativeTransferOp(
          params.smartWalletAddress,
          params.privateKey,
          params.recipientAddress,
          tokenAmount
        );
      } else {
        // ERC-20 token transfer
        userOp = await AccountAbstractionService.createERC20TransferOp(
          params.smartWalletAddress,
          params.privateKey,
          estimation.token_address,
          params.recipientAddress,
          tokenAmount
        );
      }

      console.log('✅ UserOperation created');

      // Step 4: Submit UserOperation to bundler
      console.log('📤 Step 3: Submitting UserOperation to bundler...');
      const userOpHash = await BundlerService.sendUserOperation(userOp);
      console.log('✅ UserOperation submitted:', userOpHash);

      // Step 5: Record P2P transfer on backend
      console.log('🔄 Step 4: Recording P2P transfer on backend...');
      const payment = await BackendApiService.p2pTransfer({
        recipient_address: params.recipientAddress,
        amount_ngn: params.amountNGN,
        from_token: params.paymentToken,
        blockchain_network: 'lisk-sepolia',
        transaction_hash: userOpHash,
        message: params.message,
      }) as P2PTransferResponse;

      console.log('✅ P2P transfer recorded:', payment.id);

      // Step 6: Wait for UserOperation confirmation
      console.log('⏳ Step 5: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ P2P transfer completed successfully!', {
          txHash: status.transactionHash,
          paymentId: payment.id,
        });

        return {
          success: true,
          transactionHash: status.transactionHash,
          userOpHash,
          paymentId: payment.id,
          estimatedTime: 15, // P2P is faster than bill payments
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
      console.error('❌ P2P transfer failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get P2P transfer status
   */
  static async getTransferStatus(paymentId: string): Promise<P2PTransferResponse> {
    try {
      const status = await BackendApiService.getPaymentStatus(paymentId) as P2PTransferResponse;
      return status;
    } catch (error: any) {
      throw new Error(`Failed to get transfer status: ${error.message}`);
    }
  }

  /**
   * Validate recipient address
   * Check if address is a valid CPPay wallet
   */
  static async validateRecipient(address: Address): Promise<{
    valid: boolean;
    isSmartWallet: boolean;
    error?: string;
  }> {
    try {
      // Check if it's a deployed smart account
      const isDeployed = await AccountAbstractionService.isAccountDeployed(address);

      return {
        valid: true,
        isSmartWallet: isDeployed,
      };
    } catch (error: any) {
      return {
        valid: false,
        isSmartWallet: false,
        error: error.message,
      };
    }
  }
}

export default P2PTransferService;
