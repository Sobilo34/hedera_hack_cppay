/**
 * BillPaymentAdapter Contract Integration
 * 
 * This service provides integration with the BillPaymentAdapter smart contract
 * for crypto-to-naira transactions and other bill payments.
 */

import { 
  Address,
  Hex,
  createPublicClient,
  http,
  getContract,
  encodeFunctionData,
  decodeEventLog,
  keccak256,
  toBytes,
  toHex,
  toUtf8String,
  parseGwei,
} from 'viem';
import { liskSepolia, mainnet, base } from 'viem/chains';

// BillPaymentAdapter ABI (from the smart contract)
const BILL_PAYMENT_ADAPTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "providerCode", "type": "bytes32" },
          { "name": "account", "type": "address" },
          { "name": "amount", "type": "uint256" },
          { "name": "refId", "type": "bytes32" },
          { "name": "metadata", "type": "bytes" }
        ],
        "name": "request",
        "type": "tuple"
      }
    ],
    "name": "submitPayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "providerCode", "type": "bytes32" },
      { "name": "refId", "type": "bytes32" }
    ],
    "name": "isProcessed",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "providerCode", "type": "bytes32" },
      { "name": "enabled", "type": "bool" }
    ],
    "name": "setProvider",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "providerCode", "type": "bytes32" },
      { "indexed": true, "name": "refId", "type": "bytes32" },
      { "indexed": true, "name": "payer", "type": "address" },
      { "indexed": false, "name": "account", "type": "address" },
      { "indexed": false, "name": "amount", "type": "uint256" },
      { "indexed": false, "name": "metadata", "type": "bytes" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "PaymentQueued",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "providerCode", "type": "bytes32" },
      { "indexed": false, "name": "enabled", "type": "bool" },
      { "indexed": true, "name": "sender", "type": "address" }
    ],
    "name": "ProviderStatusUpdated",
    "type": "event"
  }
];

// Network configurations
const NETWORK_CONFIGS = {
  // Lisk Sepolia Testnet
  4202: {
    name: 'Lisk Sepolia',
    chain: liskSepolia,
    billPaymentAdapterAddress: '0x0000000000000000000000000000000000000000' as Address, // TODO: Replace with actual deployed address
    explorerUrl: 'https://sepolia-blockscout.lisk.com',
  },
  // Ethereum Mainnet
  1: {
    name: 'Ethereum',
    chain: mainnet,
    billPaymentAdapterAddress: '0x0000000000000000000000000000000000000000' as Address, // TODO: Replace with actual deployed address
    explorerUrl: 'https://etherscan.io',
  },
  // Base Mainnet
  8453: {
    name: 'Base',
    chain: base,
    billPaymentAdapterAddress: '0x0000000000000000000000000000000000000000' as Address, // TODO: Replace with actual deployed address
    explorerUrl: 'https://basescan.org',
  }
};

export interface PaymentRequest {
  providerCode: string;  // e.g., 'PAYSTACK_NGN', 'AIRTIME_MTN', etc.
  account: string;       // Smart account address
  amount: bigint;        // Amount in wei/smallest unit
  refId: string;         // Unique reference ID
  metadata: {            // Payment-specific metadata
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
    phoneNumber?: string;
    provider?: string;
    memo?: string;
    [key: string]: any;
  };
}

export interface PaymentResult {
  transactionHash: string;
  paymentId: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  effectiveGasPrice?: string;
}

export interface PaymentEvent {
  providerCode: string;
  account: string;
  amount: string;
  refId: string;
  metadata: string;
  blockNumber: number;
  transactionHash: string;
}

class BillPaymentAdapterService {
  private publicClient: any;
  private contract: any;
  private network: any;
  private chainId: number;

  constructor(chainId: number) {
    console.log(`🏗️ MOCK: BillPaymentAdapter initialized for chain ${chainId}`);
    this.chainId = chainId;
    
    // Mock network config
    this.network = {
      chainId,
      name: 'Mock Network',
      billPaymentAdapterAddress: '0x1234567890123456789012345678901234567890',
      explorerUrl: 'https://mock-explorer.com',
    };
    
    // No real client initialization needed for mocking
    this.publicClient = {};
    this.contract = {};
  }

  /**
   * Create a payment request for crypto-to-naira conversion
   */
  createCryptoToNairaRequest(
    smartAccountAddress: string,
    nairaAmount: number,
    bankDetails: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    },
    cryptoDetails: {
      token: string;
      amount: number;
    },
    memo?: string
  ): PaymentRequest {
    const refId = this.generateUniqueReference('CTN');
    
    // Convert naira to kobo (smallest unit)
    const amountInKobo = BigInt(Math.round(nairaAmount * 100));
    
    const metadata = {
      type: 'crypto_to_naira',
      bankCode: bankDetails.bankCode,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
      cryptoToken: cryptoDetails.token,
      cryptoAmount: cryptoDetails.amount,
      memo: memo || '',
      timestamp: Date.now(),
    };

    return {
      providerCode: 'PAYSTACK_NGN',
      account: smartAccountAddress,
      amount: amountInKobo,
      refId,
      metadata,
    };
  }

  /**
   * Create call data for submitPayment function (MOCKED)
   */
  createSubmitPaymentCallData(paymentRequest: PaymentRequest): Hex {
    console.log('🏗️ MOCK: Creating submit payment call data');
    
    // Return mock call data
    return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex;
  }

  /**
   * Check if a payment has been processed (MOCKED)
   */
  async isPaymentProcessed(providerCode: string, refId: string): Promise<boolean> {
    console.log(`🏗️ MOCK: Checking if payment ${refId} is processed`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return false to simulate unprocessed payment for testing
    return false;
  }

  /**
   * Estimate gas for submitPayment transaction
   */
  async estimateSubmitPaymentGas(
    paymentRequest: PaymentRequest,
    fromAddress: string
  ): Promise<bigint> {
    try {
      const providerCodeBytes32 = keccak256(toBytes(paymentRequest.providerCode));
      const refIdBytes32 = keccak256(toBytes(paymentRequest.refId));
      const metadataBytes = toHex(toBytes(JSON.stringify(paymentRequest.metadata)));
      
      const paymentStruct = {
        providerCode: providerCodeBytes32,
        account: paymentRequest.account as Address,
        amount: paymentRequest.amount,
        refId: refIdBytes32,
        metadata: metadataBytes,
      };

      const gasEstimate = await this.publicClient.estimateGas({
        account: fromAddress as Address,
        to: this.network.billPaymentAdapterAddress,
        data: encodeFunctionData({
          abi: BILL_PAYMENT_ADAPTER_ABI,
          functionName: 'submitPayment',
          args: [paymentStruct],
        }),
      });
      
      return gasEstimate;
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      // Return a reasonable default gas estimate
      return BigInt(150000); // 150k gas units
    }
  }

  /**
   * Get current gas price from the network
   */
  async getCurrentGasPrice(): Promise<{ gasPrice: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      
      return {
        gasPrice: gasPrice,
        maxFeePerGas: gasPrice * BigInt(2), // Estimate 2x gas price for max fee
        maxPriorityFeePerGas: parseGwei('2'), // 2 gwei priority fee
      };
    } catch (error) {
      console.error('Failed to get gas price:', error);
      // Return reasonable defaults
      return {
        gasPrice: parseGwei('20'),
        maxFeePerGas: parseGwei('30'),
        maxPriorityFeePerGas: parseGwei('2'),
      };
    }
  }

  /**
   * Monitor transaction confirmation
   */
  async waitForTransactionConfirmation(
    transactionHash: string,
    confirmations: number = 1,
    timeout: number = 300000 // 5 minutes
  ): Promise<any> {
    try {
      console.log(`⏳ Waiting for transaction confirmation: ${transactionHash}`);
      
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash as Hex,
        confirmations: confirmations,
        timeout: timeout,
      });
      
      if (!receipt) {
        throw new Error('Transaction not found or timeout');
      }
      
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      return receipt;
      
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Parse PaymentQueued events from transaction receipt
   */
  parsePaymentQueuedEvents(receipt: any): Array<{
    providerCode: string;
    refId: string;
    payer: string;
    account: string;
    amount: bigint;
    metadata: any;
    timestamp: number;
  }> {
    const events: any[] = [];
    
    try {
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({
            abi: BILL_PAYMENT_ADAPTER_ABI,
            data: log.data,
            topics: log.topics,
          });
          
          if (parsed && parsed.eventName === 'PaymentQueued') {
            events.push({
              providerCode: parsed.args.providerCode as string,
              refId: parsed.args.refId as string,
              payer: parsed.args.payer as string,
              account: parsed.args.account as string,
              amount: parsed.args.amount as bigint,
              metadata: parsed.args.metadata,
              timestamp: Number(parsed.args.timestamp),
            });
          }
        } catch (logError) {
          // Skip logs that don't match our contract
          continue;
        }
      }
    } catch (error) {
      console.error('Failed to parse events:', error);
    }
    
    return events;
  }

  /**
   * Get all payments for an account
   */
  async getAccountPayments(accountAddress: string): Promise<PaymentEvent[]> {
    try {
      const events = await this.publicClient.getLogs({
        address: this.network.billPaymentAdapterAddress,
        event: {
          type: 'event',
          name: 'PaymentSubmitted',
          inputs: [
            { name: 'providerCode', type: 'bytes32', indexed: true },
            { name: 'account', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'refId', type: 'bytes32', indexed: true },
            { name: 'metadata', type: 'bytes', indexed: false },
          ],
        },
        args: {
          account: accountAddress as Address,
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
      });
      
      return events.map((event) => ({
        providerCode: event.args.providerCode as string,
        account: event.args.account as string,
        amount: (event.args.amount as bigint).toString(),
        refId: event.args.refId as string,
        metadata: toUtf8String(event.args.metadata as Hex),
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
      }));
    } catch (error) {
      console.error('Failed to get account payments:', error);
      return [];
    }
  }

  /**
   * Get payment by reference ID
   */
  async getPaymentByRefId(refId: string): Promise<PaymentEvent | null> {
    try {
      const refIdBytes32 = keccak256(toBytes(refId));
      const events = await this.publicClient.getLogs({
        address: this.network.billPaymentAdapterAddress,
        event: {
          type: 'event',
          name: 'PaymentSubmitted',
          inputs: [
            { name: 'providerCode', type: 'bytes32', indexed: true },
            { name: 'account', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'refId', type: 'bytes32', indexed: true },
            { name: 'metadata', type: 'bytes', indexed: false },
          ],
        },
        args: {
          refId: refIdBytes32,
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
      });
      
      if (events.length === 0) return null;
      
      const event = events[0];
      return {
        providerCode: event.args.providerCode as string,
        account: event.args.account as string,
        amount: (event.args.amount as bigint).toString(),
        refId: event.args.refId as string,
        metadata: toUtf8String(event.args.metadata as Hex),
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
      };
    } catch (error) {
      console.error('Failed to get payment by refId:', error);
      return null;
    }
  }

  /**
   * Watch for new PaymentSubmitted events
   */
  onPaymentSubmitted(
    callback: (payment: PaymentEvent) => void,
    account?: string
  ): () => void {
    try {
      const unwatch = this.publicClient.watchEvent({
        address: this.network.billPaymentAdapterAddress,
        event: {
          type: 'event',
          name: 'PaymentSubmitted',
          inputs: [
            { name: 'providerCode', type: 'bytes32', indexed: true },
            { name: 'account', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'refId', type: 'bytes32', indexed: true },
            { name: 'metadata', type: 'bytes', indexed: false },
          ],
        },
        args: account ? { account: account as Address } : undefined,
        onLogs: (logs) => {
          logs.forEach((log) => {
            callback({
              providerCode: log.args.providerCode as string,
              account: log.args.account as string,
              amount: (log.args.amount as bigint).toString(),
              refId: log.args.refId as string,
              metadata: toUtf8String(log.args.metadata as Hex),
              blockNumber: Number(log.blockNumber),
              transactionHash: log.transactionHash,
            });
          });
        },
      });
      
      return unwatch;
    } catch (error) {
      console.error('Failed to set up payment listener:', error);
      return () => {};
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.network.billPaymentAdapterAddress;
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Generate a unique reference ID
   */
  generateUniqueReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    return {
      chainId: this.network.chainId,
      name: this.network.name,
      contractAddress: this.network.billPaymentAdapterAddress,
      explorerUrl: this.network.explorerUrl,
    };
  }

  /**
   * Create airtime purchase request
   */
  createAirtimePurchaseRequest(
    smartAccountAddress: string,
    phoneNumber: string,
    amount: number,
    provider: string, // MTN, GLO, AIRTEL, 9MOBILE
  ): PaymentRequest {
    const refId = this.generateUniqueReference('AIRTIME');
    const amountInKobo = BigInt(Math.round(amount * 100));
    
    const metadata = {
      type: 'airtime',
      phoneNumber,
      provider: provider.toUpperCase(),
      timestamp: Date.now(),
    };

    return {
      providerCode: `AIRTIME_${provider.toUpperCase()}`,
      account: smartAccountAddress,
      amount: amountInKobo,
      refId,
      metadata,
    };
  }

  /**
   * Create electricity bill payment request
   */
  createElectricityPaymentRequest(
    smartAccountAddress: string,
    meterNumber: string,
    amount: number,
    provider: string, // IKEDC, EKEDC, etc.
    meterType: 'prepaid' | 'postpaid' = 'prepaid'
  ): PaymentRequest {
    const refId = this.generateUniqueReference('ELECTRICITY');
    const amountInKobo = BigInt(Math.round(amount * 100));
    
    const metadata = {
      type: 'electricity',
      meterNumber,
      provider: provider.toUpperCase(),
      meterType,
      timestamp: Date.now(),
    };

    return {
      providerCode: `ELECTRICITY_${provider.toUpperCase()}`,
      account: smartAccountAddress,
      amount: amountInKobo,
      refId,
      metadata,
    };
  }

  /**
   * Create cable TV subscription request
   */
  createCableTVPaymentRequest(
    smartAccountAddress: string,
    smartCardNumber: string,
    amount: number,
    provider: string, // DSTV, GOTV, STARTIMES
    bouquetCode?: string
  ): PaymentRequest {
    const refId = this.generateUniqueReference('CABLETV');
    const amountInKobo = BigInt(Math.round(amount * 100));
    
    const metadata = {
      type: 'cabletv',
      smartCardNumber,
      provider: provider.toUpperCase(),
      bouquetCode,
      timestamp: Date.now(),
    };

    return {
      providerCode: `CABLETV_${provider.toUpperCase()}`,
      account: smartAccountAddress,
      amount: amountInKobo,
      refId,
      metadata,
    };
  }

  /**
   * Create internet data purchase request
   */
  createDataPurchaseRequest(
    smartAccountAddress: string,
    phoneNumber: string,
    dataPlanId: string,
    amount: number,
    provider: string
  ): PaymentRequest {
    const refId = this.generateUniqueReference('DATA');
    const amountInKobo = BigInt(Math.round(amount * 100));
    
    const metadata = {
      type: 'data',
      phoneNumber,
      dataPlanId,
      provider: provider.toUpperCase(),
      timestamp: Date.now(),
    };

    return {
      providerCode: `DATA_${provider.toUpperCase()}`,
      account: smartAccountAddress,
      amount: amountInKobo,
      refId,
      metadata,
    };
  }
}

export default BillPaymentAdapterService;