/**
 * Feature 5: Send Crypto Service
 * Direct cryptocurrency transfer to any address
 */

import BackendApiService from '../BackendApiService';
import AccountAbstractionService from '../AccountAbstractionService';
import BundlerService from '../BundlerService';
import SwapService, { TOKEN_ADDRESSES, TOKEN_DECIMALS } from '../SwapService';
import type { Address, Hex } from 'viem';
import { parseUnits, isAddress } from 'viem';

export interface CryptoSendParams {
  smartWalletAddress: Address;
  privateKey: Hex;
  recipientAddress: Address;
  amount: string; // Token amount (not NGN)
  token: string; // ETH, BNB, LISK, USDT, USDC, CNGN
}

export interface CryptoSendResult {
  success: boolean;
  transactionHash?: Hex;
  userOpHash?: Hex;
  estimatedTime: number;
  error?: string;
}

class CryptoSendService {
  /**
   * Send cryptocurrency directly to an address
   * 
   * Flow:
   * 1. Validate recipient address
   * 2. Create UserOperation for token transfer
   * 3. Submit UserOperation to bundler
   * 4. Wait for confirmation
   * 5. Record transaction on backend
   */
  static async sendCrypto(
    params: CryptoSendParams
  ): Promise<CryptoSendResult> {
    try {
      console.log('💰 Starting crypto send...', {
        recipient: params.recipientAddress,
        amount: params.amount,
        token: params.token,
      });

      // Step 1: Validate recipient address
      if (!isAddress(params.recipientAddress)) {
        return {
          success: false,
          estimatedTime: 0,
          error: 'Invalid recipient address',
        };
      }

      // Step 2: Validate token
      const supportedTokens = SwapService.getSupportedTokens();
      if (!supportedTokens.includes(params.token)) {
        return {
          success: false,
          estimatedTime: 0,
          error: `Unsupported token: ${params.token}`,
        };
      }

      // Step 3: Parse amount with correct decimals
      const tokenDecimals = TOKEN_DECIMALS[params.token];
      const tokenAmount = parseUnits(params.amount, tokenDecimals);

      console.log('💎 Token amount to send:', {
        amount: params.amount,
        decimals: tokenDecimals,
        wei: tokenAmount.toString(),
      });

      // Step 4: Create UserOperation
      console.log('🔨 Step 1: Creating UserOperation...');
      let userOp;

      if (params.token === 'ETH' || params.token === 'BNB' || params.token === 'LISK') {
        // Native token transfer
        userOp = await AccountAbstractionService.createNativeTransferOp(
          params.smartWalletAddress,
          params.privateKey,
          params.recipientAddress,
          tokenAmount
        );
      } else {
        // ERC-20 token transfer
        const tokenAddress = TOKEN_ADDRESSES[params.token];
        userOp = await AccountAbstractionService.createERC20TransferOp(
          params.smartWalletAddress,
          params.privateKey,
          tokenAddress,
          params.recipientAddress,
          tokenAmount
        );
      }

      console.log('✅ UserOperation created');

      // Step 5: Submit UserOperation to bundler
      console.log('📤 Step 2: Submitting UserOperation to bundler...');
      const userOpHash = await BundlerService.sendUserOperation(userOp);
      console.log('✅ UserOperation submitted:', userOpHash);

      // Step 6: Record transaction on backend
      console.log('📝 Step 3: Recording transaction on backend...');
      try {
        await BackendApiService.sendTransaction({
          from_address: params.smartWalletAddress,
          to_address: params.recipientAddress,
          token_address: params.token === 'ETH' || params.token === 'BNB' || params.token === 'LISK'
            ? undefined
            : TOKEN_ADDRESSES[params.token],
          amount: params.amount,
          network: 'lisk-sepolia',
          data: userOp.callData,
        });
      } catch (error) {
        console.warn('⚠️ Failed to record on backend (non-critical):', error);
      }

      // Step 7: Wait for UserOperation confirmation
      console.log('⏳ Step 4: Waiting for transaction confirmation...');
      const status = await BundlerService.waitForUserOp(userOpHash, 60000);

      if (status.status === 'included') {
        console.log('✅ Crypto send completed successfully!', {
          txHash: status.transactionHash,
        });

        return {
          success: true,
          transactionHash: status.transactionHash,
          userOpHash,
          estimatedTime: 15,
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
      console.error('❌ Crypto send failed:', error);
      return {
        success: false,
        estimatedTime: 0,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get transaction details
   */
  static async getTransactionDetails(txHash: Hex): Promise<any> {
    try {
      return await BackendApiService.getTransactionStatus(txHash);
    } catch (error: any) {
      throw new Error(`Failed to get transaction details: ${error.message}`);
    }
  }

  /**
   * Validate address format
   */
  static validateAddress(address: string): {
    valid: boolean;
    error?: string;
  } {
    if (!address) {
      return { valid: false, error: 'Address is required' };
    }

    if (!isAddress(address)) {
      return { valid: false, error: 'Invalid Ethereum address format' };
    }

    return { valid: true };
  }

  /**
   * Format token amount for display
   */
  static formatAmount(amount: string, token: string): string {
    const decimals = TOKEN_DECIMALS[token] || 18;
    const num = parseFloat(amount);
    
    if (decimals === 6) {
      return num.toFixed(6);
    } else {
      return num.toFixed(8);
    }
  }
}

export default CryptoSendService;
