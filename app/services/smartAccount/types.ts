import { Hex, Address } from 'viem';

/**
 * ERC-4337 UserOperation structure
 */
export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Smart account information
 */
export interface SmartAccountInfo {
  address: Address;
  eoaAddress: Address;
  isDeployed: boolean;
  nonce: bigint;
  balance: bigint;
}

/**
 * Bundler configuration
 */
export interface BundlerConfig {
  rpcUrl: string;
  apiKey: string;
  entryPointAddress: Address;
  chainId: number;
}

/**
 * Paymaster configuration
 */
export interface PaymasterConfig {
  enabled: boolean;
  rpcUrl: string;
  policyId?: string;
  maxSponsoredAmount: number; // in NGN
}

/**
 * Gas estimate for UserOperation
 */
export interface GasEstimate {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/**
 * Transaction parameters for smart account
 */
export interface SmartAccountTransaction {
  to: Address;
  value: bigint;
  data: Hex;
}

/**
 * Batch transaction parameters
 */
export interface BatchTransaction {
  transactions: SmartAccountTransaction[];
}

/**
 * UserOperation receipt
 */
export interface UserOperationReceipt {
  userOpHash: Hex;
  sender: Address;
  nonce: bigint;
  success: boolean;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  logs: any[];
  receipt: {
    transactionHash: Hex;
    blockNumber: bigint;
    blockHash: Hex;
  };
}

/**
 * Smart account client configuration
 */
export interface SmartAccountClientConfig {
  eoaPrivateKey: Hex;
  chainId: number;
  bundlerUrl: string;
  paymasterUrl?: string;
  entryPointAddress: Address;
  factoryAddress: Address;
}

/**
 * Gas sponsorship policy
 */
export interface GasSponsorshipPolicy {
  isEligible: boolean;
  reason: string;
  maxSponsoredAmount: number;
  currentUsage: number;
  resetDate: number;
}
