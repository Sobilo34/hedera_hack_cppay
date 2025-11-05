/**
 * SmartAccountService Integration with PaymasterService
 * 
 * This file extends SmartAccountService to integrate gas sponsorship
 * via the PaymasterService. It automatically includes paymaster data
 * in UserOperations when gas allowance is available.
 * 
 * Usage:
 * import { enhanceUserOpWithPaymaster } from '@/services/smartAccount/PaymasterIntegration';
 * 
 * const userOp = await enhanceUserOpWithPaymaster(userOp, smartAccountAddress, chainId);
 */

import PaymasterService from '../PaymasterService';
import type { UserOperation } from './types';
import { Address, Hex, formatEther } from 'viem';

/**
 * Enhance UserOperation with paymaster data if eligible
 * 
 * This function:
 * 1. Checks if user has remaining gas allowance
 * 2. Validates estimated gas cost against allowance
 * 3. Adds paymaster data if eligible
 * 4. Falls back to user-paid gas if not eligible
 * 
 * @param userOp - Original UserOperation
 * @param smartAccountAddress - User's smart account address
 * @param chainId - Chain ID (must be Lisk: 1135 or 4202)
 * @returns Enhanced UserOperation with paymaster data
 */
export async function enhanceUserOpWithPaymaster(
  userOp: Partial<UserOperation>,
  smartAccountAddress: string,
  chainId: number
): Promise<Partial<UserOperation>> {
  console.log('🔧 Enhancing UserOp with paymaster integration...');
  
  try {
    const paymasterService = PaymasterService.getInstance();
    
    // Build UserOp with paymaster (includes eligibility check)
    const enhancedOp = await paymasterService.buildPaymasterUserOp(
      userOp,
      smartAccountAddress,
      chainId
    );
    
    // Log sponsorship status
    if (enhancedOp.paymasterAndData && enhancedOp.paymasterAndData !== '0x') {
      console.log('✅ Gas sponsorship enabled for this transaction');
    } else {
      console.log('⚠️ Using user-paid gas for this transaction');
    }
    
    return enhancedOp;
  } catch (error: any) {
    console.error('❌ Paymaster integration failed:', error);
    console.log('⚠️ Falling back to user-paid gas');
    
    // Fallback: return original UserOp without paymaster
    return {
      ...userOp,
      paymasterAndData: '0x' as Hex,
    };
  }
}

/**
 * Estimate transaction cost and check gas sponsorship eligibility
 * 
 * Use this before sending a transaction to inform the user
 * whether their gas will be sponsored or not.
 * 
 * @param estimatedGas - Estimated gas units
 * @param maxFeePerGas - Max fee per gas in wei
 * @param smartAccountAddress - User's smart account address
 * @param chainId - Chain ID
 * @returns Sponsorship check result with user-friendly message
 */
export async function checkTransactionSponsorship(
  estimatedGas: bigint,
  maxFeePerGas: bigint,
  smartAccountAddress: string,
  chainId: number
): Promise<{
  willSponsor: boolean;
  message: string;
  estimatedCost: bigint;
  remainingAllowance?: bigint;
}> {
  console.log('🔍 Checking transaction sponsorship...');
  
  try {
    const paymasterService = PaymasterService.getInstance();
    
    // Calculate total cost
    const estimatedCost = estimatedGas * maxFeePerGas;
    
    // Check if can sponsor
    const check = await paymasterService.checkGasSponsorship(
      smartAccountAddress,
      estimatedCost,
      chainId
    );
    
    if (check.canSponsor) {
      return {
        willSponsor: true,
        message: `✅ Gas Sponsored - ${PaymasterService.formatGasAmount(estimatedCost)} covered`,
        estimatedCost,
        remainingAllowance: check.remainingGas,
      };
    } else {
      return {
        willSponsor: false,
        message: check.reason || '⚠️ Gas will be paid from your wallet',
        estimatedCost,
        remainingAllowance: check.remainingGas,
      };
    }
  } catch (error: any) {
    console.error('❌ Sponsorship check failed:', error);
    
    const estimatedCost = estimatedGas * maxFeePerGas;
    return {
      willSponsor: false,
      message: '⚠️ Gas will be paid from your wallet',
      estimatedCost,
    };
  }
}

/**
 * Get gas allowance summary for UI display
 * 
 * @param smartAccountAddress - User's smart account address
 * @param chainId - Chain ID
 * @returns Gas allowance summary or null if unavailable
 */
export async function getGasAllowanceSummary(
  smartAccountAddress: string,
  chainId: number
): Promise<{
  remaining: string;
  limit: string;
  percentUsed: number;
  resetTime: string;
  isVerified: boolean;
} | null> {
  try {
    const paymasterService = PaymasterService.getInstance();
    const status = await paymasterService.getGasAllowanceStatus(smartAccountAddress, chainId);
    
    if (!status) return null;
    
    return {
      remaining: PaymasterService.formatGasAmount(status.remaining),
      limit: PaymasterService.formatGasAmount(status.limit),
      percentUsed: status.percentUsed,
      resetTime: PaymasterService.getTimeUntilReset(status.resetTime),
      isVerified: status.isVerified,
    };
  } catch (error) {
    console.error('Failed to get gas allowance summary:', error);
    return null;
  }
}

/**
 * Hook to automatically enhance UserOps in transaction flows
 * 
 * Example usage in SmartAccountService:
 * 
 * ```typescript
 * import { enhanceUserOpWithPaymaster } from './PaymasterIntegration';
 * 
 * async sendTransaction(userOp, smartAccountAddress, chainId) {
 *   // Enhance with paymaster
 *   const enhancedOp = await enhanceUserOpWithPaymaster(
 *     userOp,
 *     smartAccountAddress,
 *     chainId
 *   );
 *   
 *   // Send enhanced UserOp
 *   return await bundler.sendUserOperation(enhancedOp);
 * }
 * ```
 */
export const PaymasterIntegration = {
  enhanceUserOp: enhanceUserOpWithPaymaster,
  checkSponsorship: checkTransactionSponsorship,
  getSummary: getGasAllowanceSummary,
};

export default PaymasterIntegration;
