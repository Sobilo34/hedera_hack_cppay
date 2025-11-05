/**
 * Enhanced TransactionService with Backend API Integration
 * Integrates:
 * - BackendApiService (for payments, KYC, price oracle)
 * - AccountAbstractionService (for ERC-4337 UserOperations)
 * - BundlerService (for Pimlico bundler)
 * - SwapService (for token swaps)
 */

import BackendApiService from './BackendApiService';
import AccountAbstractionService from './AccountAbstractionService';
import BundlerService from './BundlerService';
import SwapService from './SwapService';
import type { Address, Hex } from 'viem';
import { parseUnits, formatUnits } from 'viem';

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentResult {
  transactionHash: Hex;
  userOpHash: Hex;
  status: 'pending' | 'success' | 'failed';
  paymentId: string;
  estimatedTime: number; // seconds
}

export interface TokenBalance {
  token: string;
  balance: string;
  balanceNGN: string;
  price: number;
}

export interface TransactionFees {
  platformFee: string;
  networkFee: string;
  total: string;
  currency: string;
  isGasSponsored: boolean;
}

// ============================================================================
// ENHANCED TRANSACTION SERVICE
// ============================================================================

class EnhancedTransactionService {
  /**
   * Purchase Airtime
   * Flow: Convert crypto → CNGN → Backend processes Flutterwave purchase
   */
  static async purchaseAirtime(
    smartWalletAddress: Address,
    privateKey: Hex,
    phone: string,
    amountNGN: number,
    provider: string,
    paymentToken: string
  ): Promise<PaymentResult> {
    try {
      console.log('📱 Purchasing airtime...', { phone, amountNGN, provider });

      // 1. Estimate payment (get token amount needed)
      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'airtime',
        amount_ngn: amountNGN,
        from_token: paymentToken,
      });

      // 2. Check gas sponsorship eligibility
      const sponsorship = await BackendApiService.checkGasSponsorship(smartWalletAddress);

      // 3. Create UserOperation for payment
      // For airtime: We need to transfer tokens to our backend contract
      const tokenAmount = parseUnits(
        estimation.token_amount,
        paymentToken === 'USDT' || paymentToken === 'USDC' ? 6 : 18
      );

      const userOp = await AccountAbstractionService.createERC20TransferOp(
        smartWalletAddress,
        privateKey,
        estimation.token_address as Address,
        process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address,
        tokenAmount
      );

      // 4. Submit UserOperation
      const userOpHash = await BundlerService.sendUserOperation(userOp);

      // 5. Initiate airtime purchase on backend
      const payment = await BackendApiService.buyAirtime({
        phone_number: phone,
        amount: amountNGN,
        provider,
        from_token: paymentToken,
        user_op_hash: userOpHash,
        smart_wallet_address: smartWalletAddress,
      });

      // 6. Wait for UserOperation confirmation
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      console.log('✅ Airtime purchase completed:', payment);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: payment.id,
        estimatedTime: 30,
      };
    } catch (error: any) {
      console.error('❌ Airtime purchase failed:', error);
      throw new Error(`Airtime purchase failed: ${error.message}`);
    }
  }

  /**
   * Buy Data
   */
  static async buyData(
    smartWalletAddress: Address,
    privateKey: Hex,
    phone: string,
    amountNGN: number,
    provider: string,
    dataCode: string,
    paymentToken: string
  ): Promise<PaymentResult> {
    try {
      console.log('📶 Buying data...', { phone, amountNGN, provider, dataCode });

      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'data',
        amount_ngn: amountNGN,
        from_token: paymentToken,
      });

      const tokenAmount = parseUnits(
        estimation.token_amount,
        paymentToken === 'USDT' || paymentToken === 'USDC' ? 6 : 18
      );

      const userOp = await AccountAbstractionService.createERC20TransferOp(
        smartWalletAddress,
        privateKey,
        estimation.token_address as Address,
        process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address,
        tokenAmount
      );

      const userOpHash = await BundlerService.sendUserOperation(userOp);

      const payment = await BackendApiService.buyData({
        phone_number: phone,
        amount: amountNGN,
        provider,
        data_code: dataCode,
        from_token: paymentToken,
        user_op_hash: userOpHash,
        smart_wallet_address: smartWalletAddress,
      });

      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: payment.id,
        estimatedTime: 30,
      };
    } catch (error: any) {
      console.error('❌ Data purchase failed:', error);
      throw new Error(`Data purchase failed: ${error.message}`);
    }
  }

  /**
   * P2P Transfer (NGN to CPPay)
   */
  static async sendP2P(
    smartWalletAddress: Address,
    privateKey: Hex,
    recipientPhone: string,
    amountNGN: number,
    paymentToken: string
  ): Promise<PaymentResult> {
    try {
      console.log('💸 Sending P2P transfer...', { recipientPhone, amountNGN });

      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'p2p',
        amount_ngn: amountNGN,
        from_token: paymentToken,
      });

      const tokenAmount = parseUnits(
        estimation.token_amount,
        paymentToken === 'USDT' || paymentToken === 'USDC' ? 6 : 18
      );

      const userOp = await AccountAbstractionService.createERC20TransferOp(
        smartWalletAddress,
        privateKey,
        estimation.token_address as Address,
        process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address,
        tokenAmount
      );

      const userOpHash = await BundlerService.sendUserOperation(userOp);

      const payment = await BackendApiService.p2pTransfer({
        recipient_phone: recipientPhone,
        amount_ngn: amountNGN,
        from_token: paymentToken,
        user_op_hash: userOpHash,
        smart_wallet_address: smartWalletAddress,
      });

      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: payment.id,
        estimatedTime: 30,
      };
    } catch (error: any) {
      console.error('❌ P2P transfer failed:', error);
      throw new Error(`P2P transfer failed: ${error.message}`);
    }
  }

  /**
   * Bank Transfer (NGN to Bank)
   */
  static async bankTransfer(
    smartWalletAddress: Address,
    privateKey: Hex,
    bankAccount: string,
    bankCode: string,
    accountName: string,
    amountNGN: number,
    paymentToken: string
  ): Promise<PaymentResult> {
    try {
      console.log('🏦 Processing bank transfer...', { bankAccount, amountNGN });

      const estimation = await BackendApiService.estimatePayment({
        payment_type: 'bank_transfer',
        amount_ngn: amountNGN,
        from_token: paymentToken,
      });

      const tokenAmount = parseUnits(
        estimation.token_amount,
        paymentToken === 'USDT' || paymentToken === 'USDC' ? 6 : 18
      );

      const userOp = await AccountAbstractionService.createERC20TransferOp(
        smartWalletAddress,
        privateKey,
        estimation.token_address as Address,
        process.env.EXPO_PUBLIC_BACKEND_CONTRACT_ADDRESS as Address,
        tokenAmount
      );

      const userOpHash = await BundlerService.sendUserOperation(userOp);

      const payment = await BackendApiService.bankTransfer({
        account_number: bankAccount,
        bank_code: bankCode,
        account_name: accountName,
        amount: amountNGN,
        from_token: paymentToken,
        user_op_hash: userOpHash,
        smart_wallet_address: smartWalletAddress,
      });

      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: payment.id,
        estimatedTime: 120, // Bank transfers take longer
      };
    } catch (error: any) {
      console.error('❌ Bank transfer failed:', error);
      throw new Error(`Bank transfer failed: ${error.message}`);
    }
  }

  /**
   * Send Crypto (direct token transfer)
   */
  static async sendCrypto(
    smartWalletAddress: Address,
    privateKey: Hex,
    recipientAddress: Address,
    amount: string,
    token: string
  ): Promise<PaymentResult> {
    try {
      console.log('💰 Sending crypto...', { recipientAddress, amount, token });

      const tokenDecimals = token === 'USDT' || token === 'USDC' ? 6 : 18;
      const tokenAmount = parseUnits(amount, tokenDecimals);

      let userOp;
      if (token === 'ETH' || token === 'BNB' || token === 'LISK') {
        // Native token transfer
        userOp = await AccountAbstractionService.createNativeTransferOp(
          smartWalletAddress,
          privateKey,
          recipientAddress,
          tokenAmount
        );
      } else {
        // ERC-20 token transfer
        const tokenAddress = SwapService.TOKEN_ADDRESSES[token];
        userOp = await AccountAbstractionService.createERC20TransferOp(
          smartWalletAddress,
          privateKey,
          tokenAddress,
          recipientAddress,
          tokenAmount
        );
      }

      const userOpHash = await BundlerService.sendUserOperation(userOp);

      // Record transaction on backend
      await BackendApiService.sendTransaction({
        from_address: smartWalletAddress,
        to_address: recipientAddress,
        token_address: SwapService.TOKEN_ADDRESSES[token],
        amount,
        network: 'lisk-sepolia',
        data: userOp.callData,
      });

      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: userOpHash,
        estimatedTime: 15,
      };
    } catch (error: any) {
      console.error('❌ Crypto send failed:', error);
      throw new Error(`Crypto send failed: ${error.message}`);
    }
  }

  /**
   * Swap Tokens
   */
  static async swapTokens(
    smartWalletAddress: Address,
    privateKey: Hex,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 0.5
  ): Promise<PaymentResult> {
    try {
      console.log('🔄 Swapping tokens...', { fromToken, toToken, amount });

      // 1. Get best swap quote
      const quote = await SwapService.getBestQuote({
        fromToken,
        toToken,
        amount,
        slippage,
        userAddress: smartWalletAddress,
      });

      console.log('💡 Best quote:', SwapService.formatSwapSummary(quote));

      // 2. Check if swap is safe
      const safety = SwapService.isSwapSafe(quote);
      if (!safety.safe) {
        throw new Error(`Unsafe swap: ${safety.reason}`);
      }

      // 3. Get swap transaction data
      const swapData = await SwapService.get1inchSwapData({
        fromToken,
        toToken,
        amount,
        slippage,
        userAddress: smartWalletAddress,
      });

      // 4. Create UserOperation for swap
      const userOp = await AccountAbstractionService.createSwapAndTransferOp(
        smartWalletAddress,
        privateKey,
        swapData.data,
        swapData.to,
        smartWalletAddress, // Send result back to user
        parseUnits(quote.toAmount, SwapService.TOKEN_DECIMALS[toToken])
      );

      // 5. Submit UserOperation
      const userOpHash = await BundlerService.sendUserOperation(userOp);

      // 6. Wait for confirmation
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      return {
        transactionHash: status.transactionHash || '0x',
        userOpHash,
        status: status.status === 'included' ? 'success' : 'failed',
        paymentId: userOpHash,
        estimatedTime: 30,
      };
    } catch (error: any) {
      console.error('❌ Token swap failed:', error);
      throw new Error(`Token swap failed: ${error.message}`);
    }
  }

  /**
   * Get Portfolio Value
   */
  static async getPortfolio(smartWalletAddress: Address): Promise<TokenBalance[]> {
    try {
      const portfolio = await BackendApiService.getPortfolio(smartWalletAddress);

      return portfolio.tokens.map((token: any) => ({
        token: token.symbol,
        balance: token.balance,
        balanceNGN: token.balance_ngn,
        price: token.price_usd,
      }));
    } catch (error: any) {
      console.error('❌ Failed to fetch portfolio:', error);
      throw error;
    }
  }

  /**
   * Get Transaction Limits (based on KYC tier)
   */
  static async getTransactionLimits(smartWalletAddress: Address): Promise<any> {
    try {
      return await BackendApiService.getTransactionLimits(smartWalletAddress);
    } catch (error: any) {
      console.error('❌ Failed to fetch transaction limits:', error);
      throw error;
    }
  }

  /**
   * Calculate Fees
   */
  static async calculateFees(
    paymentType: string,
    amountNGN: number,
    paymentToken: string
  ): Promise<TransactionFees> {
    try {
      const estimation = await BackendApiService.estimatePayment({
        payment_type: paymentType,
        amount_ngn: amountNGN,
        from_token: paymentToken,
      });

      return {
        platformFee: estimation.platform_fee_ngn.toString(),
        networkFee: estimation.network_fee_ngn.toString(),
        total: estimation.total_fee_ngn.toString(),
        currency: 'NGN',
        isGasSponsored: estimation.gas_sponsored || false,
      };
    } catch (error: any) {
      console.error('❌ Failed to calculate fees:', error);
      return {
        platformFee: '0',
        networkFee: '0',
        total: '0',
        currency: 'NGN',
        isGasSponsored: false,
      };
    }
  }

  /**
   * Check Gas Sponsorship Eligibility
   */
  static async checkGasSponsorship(smartWalletAddress: Address): Promise<{
    eligible: boolean;
    dailyLimit: string;
    usedToday: string;
    remaining: string;
  }> {
    try {
      const sponsorship = await BackendApiService.checkGasSponsorship(smartWalletAddress);

      return {
        eligible: sponsorship.is_eligible,
        dailyLimit: sponsorship.daily_limit,
        usedToday: sponsorship.used_today,
        remaining: sponsorship.remaining,
      };
    } catch (error: any) {
      console.error('❌ Failed to check gas sponsorship:', error);
      return {
        eligible: false,
        dailyLimit: '0',
        usedToday: '0',
        remaining: '0',
      };
    }
  }

  /**
   * Get NGN Exchange Rate
   */
  static async getNGNRate(): Promise<number> {
    try {
      const rate = await BackendApiService.getNGNRate();
      return rate.rate_usd;
    } catch (error: any) {
      console.error('❌ Failed to fetch NGN rate:', error);
      return 0.0006; // Default fallback
    }
  }
}

export default EnhancedTransactionService;
