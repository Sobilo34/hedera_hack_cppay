/**
 * Bundler Service - Pimlico Integration
 * Handles communication with Pimlico bundler for ERC-4337 operations
 * 
 * Features:
 * - UserOperation submission
 * - Gas sponsorship requests
 * - Transaction status tracking
 * - Paymaster integration
 */

import axios, { AxiosInstance } from 'axios';
import type { Address, Hex } from 'viem';
import type { UserOperation } from './AccountAbstractionService';
import { convertToPimlicoUserOp } from './UserOpUtils';

// Environment configuration
const PIMLICO_API_KEY = process.env.EXPO_PUBLIC_PIMLICO_API_KEY;
const CHAIN_ID = process.env.EXPO_PUBLIC_CHAIN_ID || '4202'; // Lisk Sepolia
const ENTRYPOINT_ADDRESS = process.env.EXPO_PUBLIC_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Pimlico endpoints
const BUNDLER_BASE_URL = `https://api.pimlico.io/v1/lisk-sepolia/rpc`;
const PAYMASTER_BASE_URL = `https://api.pimlico.io/v2/lisk-sepolia/rpc`;

export interface PimlicoUserOperation {
  sender: Address;
  nonce: string;
  initCode: Hex;
  callData: Hex;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface GasSponsorshipResult {
  sponsored: boolean;
  paymasterAndData?: Hex;
  preVerificationGas?: string;
  verificationGasLimit?: string;
  callGasLimit?: string;
}

export interface UserOpStatus {
  status: 'pending' | 'included' | 'failed';
  transactionHash?: Hex;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

class BundlerService {
  private bundlerClient: AxiosInstance;
  private paymasterClient: AxiosInstance;

  constructor() {
    // Bundler client for submitting UserOperations
    this.bundlerClient = axios.create({
      baseURL: BUNDLER_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIMLICO_API_KEY || '',
      },
      timeout: 30000,
    });

    // Paymaster client for gas sponsorship
    this.paymasterClient = axios.create({
      baseURL: PAYMASTER_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIMLICO_API_KEY || '',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request logging
    this.bundlerClient.interceptors.request.use((config) => {
      console.log('📤 Bundler Request:', config.method?.toUpperCase(), config.url);
      return config;
    });

    this.paymasterClient.interceptors.request.use((config) => {
      console.log('📤 Paymaster Request:', config.method?.toUpperCase(), config.url);
      return config;
    });

    // Response logging
    this.bundlerClient.interceptors.response.use(
      (response) => {
        console.log('✅ Bundler Response:', response.status, response.data);
        return response;
      },
      (error) => {
        console.error('❌ Bundler Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );

    this.paymasterClient.interceptors.response.use(
      (response) => {
        console.log('✅ Paymaster Response:', response.status, response.data);
        return response;
      },
      (error) => {
        console.error('❌ Paymaster Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send UserOperation to bundler
   * Accepts UserOperation with bigint and converts to Pimlico format
   */
  async sendUserOperation(userOp: UserOperation): Promise<Hex> {
    try {
      // Convert to Pimlico format (hex strings instead of bigint)
      const pimlicoUserOp = convertToPimlicoUserOp(userOp);

      const response = await this.bundlerClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [pimlicoUserOp, ENTRYPOINT_ADDRESS],
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to send UserOperation');
      }

      const userOpHash = response.data.result as Hex;
      console.log('✅ UserOperation sent, hash:', userOpHash);
      return userOpHash;
    } catch (error: any) {
      console.error('❌ Failed to send UserOperation:', error);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Get UserOperation receipt
   */
  async getUserOperationReceipt(userOpHash: Hex): Promise<any> {
    try {
      const response = await this.bundlerClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getUserOperationReceipt',
        params: [userOpHash],
      });

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Failed to get UserOperation receipt:', error);
      return null;
    }
  }

  /**
   * Get UserOperation status
   */
  async getUserOpStatus(userOpHash: Hex): Promise<UserOpStatus> {
    try {
      const receipt = await this.getUserOperationReceipt(userOpHash);

      if (!receipt) {
        return { status: 'pending' };
      }

      if (receipt.success) {
        return {
          status: 'included',
          transactionHash: receipt.receipt.transactionHash,
          blockNumber: parseInt(receipt.receipt.blockNumber),
          gasUsed: receipt.actualGasUsed,
        };
      } else {
        return {
          status: 'failed',
          error: receipt.reason || 'Transaction failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Failed to get UserOp status:', error);
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Request gas sponsorship from paymaster
   */
  async requestGasSponsorship(
    userOp: Partial<PimlicoUserOperation>
  ): Promise<GasSponsorshipResult> {
    try {
      const response = await this.paymasterClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_sponsorUserOperation',
        params: [
          {
            sender: userOp.sender,
            nonce: userOp.nonce,
            initCode: userOp.initCode || '0x',
            callData: userOp.callData,
            callGasLimit: userOp.callGasLimit,
            verificationGasLimit: userOp.verificationGasLimit,
            preVerificationGas: userOp.preVerificationGas,
            maxFeePerGas: userOp.maxFeePerGas,
            maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
          },
          ENTRYPOINT_ADDRESS,
        ],
      });

      if (response.data.error) {
        console.log('⚠️ Gas sponsorship denied:', response.data.error.message);
        return { sponsored: false };
      }

      const result = response.data.result;
      console.log('✅ Gas sponsorship approved:', result);

      return {
        sponsored: true,
        paymasterAndData: result.paymasterAndData,
        preVerificationGas: result.preVerificationGas,
        verificationGasLimit: result.verificationGasLimit,
        callGasLimit: result.callGasLimit,
      };
    } catch (error: any) {
      console.error('❌ Gas sponsorship request failed:', error);
      return { sponsored: false };
    }
  }

  /**
   * Estimate UserOperation gas
   */
  async estimateUserOperationGas(
    userOp: Partial<PimlicoUserOperation>
  ): Promise<{
    preVerificationGas: string;
    verificationGasLimit: string;
    callGasLimit: string;
  }> {
    try {
      const response = await this.bundlerClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateUserOperationGas',
        params: [
          {
            sender: userOp.sender,
            nonce: userOp.nonce || '0x0',
            initCode: userOp.initCode || '0x',
            callData: userOp.callData,
            signature: userOp.signature || '0x',
            maxFeePerGas: userOp.maxFeePerGas || '0x0',
            maxPriorityFeePerGas: userOp.maxPriorityFeePerGas || '0x0',
          },
          ENTRYPOINT_ADDRESS,
        ],
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Gas estimation failed');
      }

      const result = response.data.result;
      return {
        preVerificationGas: result.preVerificationGas,
        verificationGasLimit: result.verificationGasLimit,
        callGasLimit: result.callGasLimit,
      };
    } catch (error: any) {
      console.error('❌ Gas estimation failed:', error);
      // Return default values
      return {
        preVerificationGas: '0xC350', // 50000
        verificationGasLimit: '0x493E0', // 300000
        callGasLimit: '0x186A0', // 100000
      };
    }
  }

  /**
   * Get supported EntryPoint addresses
   */
  async getSupportedEntryPoints(): Promise<Address[]> {
    try {
      const response = await this.bundlerClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: [],
      });

      return response.data.result || [ENTRYPOINT_ADDRESS];
    } catch (error: any) {
      console.error('❌ Failed to get supported EntryPoints:', error);
      return [ENTRYPOINT_ADDRESS as Address];
    }
  }

  /**
   * Get chain ID
   */
  async getChainId(): Promise<string> {
    try {
      const response = await this.bundlerClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      });

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Failed to get chain ID:', error);
      return CHAIN_ID;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const chainId = await this.getChainId();
      return chainId === CHAIN_ID;
    } catch (error) {
      console.error('❌ API key validation failed:', error);
      return false;
    }
  }

  /**
   * Wait for UserOperation to be included (with timeout)
   */
  async waitForUserOp(
    userOpHash: Hex,
    timeoutMs: number = 60000,
    pollIntervalMs: number = 2000
  ): Promise<UserOpStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getUserOpStatus(userOpHash);

      if (status.status !== 'pending') {
        return status;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return {
      status: 'failed',
      error: 'Timeout waiting for UserOperation',
    };
  }
}

export default new BundlerService();
