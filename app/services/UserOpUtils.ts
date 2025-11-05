/**
 * UserOperation Utilities
 * Helper functions for converting between UserOperation formats
 */

import type { UserOperation } from './AccountAbstractionService';
import type { PimlicoUserOperation } from './BundlerService';
import type { Hex } from 'viem';

/**
 * Convert UserOperation (with bigint) to PimlicoUserOperation (with strings)
 * Pimlico expects all numeric values as hex strings
 */
export function convertToPimlicoUserOp(userOp: UserOperation): PimlicoUserOperation {
  return {
    sender: userOp.sender,
    nonce: `0x${userOp.nonce.toString(16)}`,
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

/**
 * Convert PimlicoUserOperation (with strings) to UserOperation (with bigint)
 */
export function convertFromPimlicoUserOp(pimlicoUserOp: PimlicoUserOperation): UserOperation {
  return {
    sender: pimlicoUserOp.sender,
    nonce: BigInt(pimlicoUserOp.nonce),
    initCode: pimlicoUserOp.initCode,
    callData: pimlicoUserOp.callData,
    callGasLimit: BigInt(pimlicoUserOp.callGasLimit),
    verificationGasLimit: BigInt(pimlicoUserOp.verificationGasLimit),
    preVerificationGas: BigInt(pimlicoUserOp.preVerificationGas),
    maxFeePerGas: BigInt(pimlicoUserOp.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(pimlicoUserOp.maxPriorityFeePerGas),
    paymasterAndData: pimlicoUserOp.paymasterAndData,
    signature: pimlicoUserOp.signature,
  };
}

/**
 * Format UserOperation for logging (shortened hashes)
 */
export function formatUserOpForLogging(userOp: UserOperation): any {
  return {
    sender: userOp.sender,
    nonce: userOp.nonce.toString(),
    callData: `${userOp.callData.slice(0, 10)}...`,
    callGasLimit: userOp.callGasLimit.toString(),
    verificationGasLimit: userOp.verificationGasLimit.toString(),
    preVerificationGas: userOp.preVerificationGas.toString(),
    maxFeePerGas: userOp.maxFeePerGas.toString(),
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
    paymasterAndData: userOp.paymasterAndData !== '0x' ? `${userOp.paymasterAndData.slice(0, 10)}...` : '0x',
    signature: userOp.signature !== '0x' ? `${userOp.signature.slice(0, 10)}...` : '0x',
  };
}

/**
 * Validate UserOperation has all required fields
 */
export function validateUserOp(userOp: Partial<UserOperation>): userOp is UserOperation {
  return !!(
    userOp.sender &&
    userOp.nonce !== undefined &&
    userOp.initCode &&
    userOp.callData &&
    userOp.callGasLimit &&
    userOp.verificationGasLimit &&
    userOp.preVerificationGas &&
    userOp.maxFeePerGas &&
    userOp.maxPriorityFeePerGas &&
    userOp.paymasterAndData &&
    userOp.signature
  );
}

/**
 * Calculate total gas cost for UserOperation
 */
export function calculateUserOpGasCost(userOp: UserOperation): bigint {
  const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
  return totalGas * userOp.maxFeePerGas;
}

/**
 * Get network name from chain ID
 */
export function getNetworkName(chainId: number): string {
  const networks: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    4202: 'lisk-sepolia',
    11155111: 'sepolia',
  };
  return networks[chainId] || 'unknown';
}
