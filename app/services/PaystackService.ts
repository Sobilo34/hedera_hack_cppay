/**
 * Frontend Paystack Service
 * Direct integration with Paystack API for bank verification and operations
 * 
 * MOCKED VERSION FOR TESTING - Real implementation commented out below
 * This service now provides mock data for all operations to enable end-to-end testing
 */

import axios, { AxiosInstance } from 'axios';

// Paystack API Configuration (currently mocked)
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || 'sk_test_your_secret_key_here';

export interface NigerianBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  gateway?: string;
  pay_with_bank?: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  is_deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountVerificationResult {
  account_number: string;
  account_name: string;
  bank_id: number;
  bank_name?: string;
}

export interface TransferRecipient {
  active: boolean;
  createdAt: string;
  currency: string;
  domain: string;
  id: number;
  integration: number;
  name: string;
  recipient_code: string;
  type: string;
  updatedAt: string;
  is_deleted: boolean;
  details: {
    authorization_code?: string;
    account_number: string;
    account_name?: string;
    bank_code: string;
    bank_name: string;
  };
}

export interface TransferInitiation {
  reference: string;
  integration: number;
  domain: string;
  amount: number;
  currency: string;
  source: string;
  reason: string;
  recipient: number;
  status: string;
  transfer_code: string;
  id: number;
  createdAt: string;
  updatedAt: string;
}

class PaystackService {
  private client: AxiosInstance;

  constructor() {
    // MOCKED: No actual API client needed
    console.log('🏦 PaystackService initialized in MOCK mode');
    this.client = {} as AxiosInstance; // Empty object for type compatibility
  }

  /**
   * Get list of Nigerian banks (MOCKED)
   * @returns Promise<NigerianBank[]>
   */
  async getBanks(): Promise<NigerianBank[]> {
    console.log('🏦 MOCK: Getting Nigerian banks...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock bank data
    return [
      {
        id: 1,
        name: 'Access Bank',
        slug: 'access-bank',
        code: '044',
        longcode: '044150149',
        active: true,
        country: 'NG',
        currency: 'NGN',
        type: 'commercial',
        is_deleted: false,
      },
      {
        id: 2,
        name: 'Guaranty Trust Bank',
        slug: 'guaranty-trust-bank',
        code: '058',
        longcode: '058152036',
        active: true,
        country: 'NG',
        currency: 'NGN',
        type: 'commercial',
        is_deleted: false,
      },
      {
        id: 3,
        name: 'First Bank of Nigeria',
        slug: 'first-bank-of-nigeria',
        code: '011',
        longcode: '011151003',
        active: true,
        country: 'NG',
        currency: 'NGN',
        type: 'commercial',
        is_deleted: false,
      },
      {
        id: 4,
        name: 'United Bank For Africa',
        slug: 'united-bank-for-africa',
        code: '033',
        longcode: '033153513',
        active: true,
        country: 'NG',
        currency: 'NGN',
        type: 'commercial',
        is_deleted: false,
      },
      {
        id: 5,
        name: 'Zenith Bank',
        slug: 'zenith-bank',
        code: '057',
        longcode: '057150013',
        active: true,
        country: 'NG',
        currency: 'NGN',
        type: 'commercial',
        is_deleted: false,
      },
    ];
  }

  /**
   * Verify bank account number (MOCKED)
   * @param accountNumber - Bank account number
   * @param bankCode - Bank code from getBanks()
   * @returns Promise<AccountVerificationResult>
   */
  async verifyBankAccount(
    accountNumber: string, 
    bankCode: string
  ): Promise<AccountVerificationResult> {
    console.log(`🏦 MOCK: Verifying account ${accountNumber} for bank code ${bankCode}`);
    
    if (!accountNumber || accountNumber.length !== 10) {
      throw new Error('Account number must be exactly 10 digits');
    }

    if (!bankCode) {
      throw new Error('Bank code is required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock account names based on different scenarios
    const mockNames = [
      'JOHN DOE SMITH',
      'MARY JANE JOHNSON',
      'AHMED BELLO HASSAN',
      'CHINWE OKAFOR',
      'IBRAHIM MUSA',
    ];
    
    const bankNames = {
      '044': 'Access Bank',
      '058': 'Guaranty Trust Bank', 
      '011': 'First Bank of Nigeria',
      '033': 'United Bank For Africa',
      '057': 'Zenith Bank',
    };
    
    // Generate consistent mock name based on account number
    const nameIndex = parseInt(accountNumber.slice(-1)) % mockNames.length;
    const accountName = mockNames[nameIndex];
    const bankName = bankNames[bankCode as keyof typeof bankNames] || 'Mock Bank';
    
    return {
      account_number: accountNumber,
      account_name: accountName,
      bank_id: parseInt(bankCode),
      bank_name: bankName,
    };
  }

  /**
   * Create transfer recipient for future transfers (MOCKED)
   * @param accountNumber - Bank account number  
   * @param bankCode - Bank code
   * @param accountName - Account holder name (optional)
   * @returns Promise<TransferRecipient>
   */
  async createTransferRecipient(
    accountNumber: string,
    bankCode: string,
    accountName?: string
  ): Promise<TransferRecipient> {
    console.log(`🏦 MOCK: Creating transfer recipient for ${accountNumber}`);
    
    // First verify the account to get account name if not provided
    if (!accountName) {
      const verification = await this.verifyBankAccount(accountNumber, bankCode);
      accountName = verification.account_name;
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Return mock transfer recipient
    return {
      active: true,
      createdAt: new Date().toISOString(),
      currency: 'NGN',
      domain: 'test',
      id: Math.floor(Math.random() * 100000),
      integration: 123456,
      name: accountName,
      recipient_code: `RCP_mock${Date.now()}`,
      type: 'nuban',
      updatedAt: new Date().toISOString(),
      is_deleted: false,
      details: {
        authorization_code: undefined,
        account_number: accountNumber,
        account_name: accountName,
        bank_code: bankCode,
        bank_name: `Mock Bank ${bankCode}`,
      },
    };
  }

  /**
   * Initiate bank transfer (MOCKED)
   * @param recipientCode - Recipient code from createTransferRecipient
   * @param amount - Amount in naira (will be converted to kobo)
   * @param reason - Transfer reason/memo
   * @param reference - Unique reference for the transfer
   * @returns Promise<TransferInitiation>
   */
  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reason: string,
    reference: string
  ): Promise<TransferInitiation> {
    console.log(`🏦 MOCK: Initiating transfer of ₦${amount} with reference ${reference}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const amountInKobo = Math.round(amount * 100);
    
    // Return mock transfer initiation
    return {
      integration: 123456,
      domain: 'test',
      amount: amountInKobo,
      currency: 'NGN',
      source: 'balance',
      reason: reason,
      recipient: Math.floor(Math.random() * 100000),
      status: 'success',
      reference: reference,
      transfer_code: `TRF_mock${Date.now()}`,
      id: Math.floor(Math.random() * 1000000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify transfer status (MOCKED)
   * @param reference - Transfer reference
   * @returns Promise<any>
   */
  async verifyTransfer(reference: string): Promise<any> {
    console.log(`🏦 MOCK: Verifying transfer ${reference}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      reference: reference,
      status: 'success',
      amount: Math.floor(Math.random() * 100000) + 1000,
      currency: 'NGN',
      transfer_code: `TRF_mock${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get transfer fees (MOCKED)
   * @param amount - Amount in naira
   * @returns Promise<{ fee: number, currency: string }>
   */
  async getTransferFees(amount: number): Promise<{ fee: number, currency: string }> {
    console.log(`🏦 MOCK: Getting transfer fees for ₦${amount}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock fee calculation
    let fee = 0;
    
    if (amount <= 5000) {
      fee = 10; // ₦10 for amounts up to ₦5,000
    } else if (amount <= 50000) {
      fee = 25; // ₦25 for amounts up to ₦50,000
    } else {
      fee = 50; // ₦50 for amounts above ₦50,000
    }

    return {
      fee: fee,
      currency: 'NGN'
    };
  }

  /**
   * Generate a unique reference for transfers
   * @param prefix - Optional prefix for the reference
   * @returns string
   */
  generateReference(prefix: string = 'CPPAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Validate configuration
   * @returns boolean
   */
  isConfigured(): boolean {
    return !!PAYSTACK_SECRET_KEY && PAYSTACK_SECRET_KEY !== 'sk_test_your_secret_key_here';
  }

  /**
   * Get Paystack configuration info (for debugging)
   * @returns object
   */
  getConfigInfo() {
    return {
      hasSecretKey: !!PAYSTACK_SECRET_KEY,
      isTestMode: PAYSTACK_SECRET_KEY?.startsWith('sk_test_'),
      baseUrl: PAYSTACK_BASE_URL,
    };
  }
}

// Export singleton instance
const paystackService = new PaystackService();
export default paystackService;