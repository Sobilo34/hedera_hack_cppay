/**
 * API Type Definitions
 * Complete type definitions for all Backend API responses
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// BLOCKCHAIN API TYPES
// ============================================================================

export interface SmartAccountResponse {
  address: Address;
  owner: Address;
  is_deployed: boolean;
  factory_address?: Address;
  creation_tx?: Hex;
  created_at: string;
}

export interface GasSponsorshipResponse {
  is_eligible: boolean;
  daily_limit: string;
  used_today: string;
  remaining: string;
  is_verified: boolean;
  multiplier: number;
}

export interface TransactionResponse {
  id: string;
  hash: Hex;
  from_address: Address;
  to_address: Address;
  value: string;
  status: 'pending' | 'confirmed' | 'failed';
  block_number?: number;
  gas_used?: string;
  created_at: string;
}

export interface PortfolioResponse {
  total_value_usd: number;
  total_value_ngn: number;
  tokens: {
    symbol: string;
    name: string;
    address: Address;
    balance: string;
    balance_usd: number;
    balance_ngn: number;
    price_usd: number;
  }[];
}

// ============================================================================
// PAYMENT API TYPES
// ============================================================================

export interface TokenPriceResponse {
  token: string;
  price_usd: number;
  price_ngn: number;
  source: string;
  updated_at: string;
}

export interface SwapQuoteResponse {
  from_token: string;
  to_token: string;
  from_amount: string;
  estimated_output: string;
  price_impact: number;
  slippage: number;
  route: string[];
  best_dex: string;
  estimated_gas: number;
  call_data?: Hex;
}

export interface PaymentEstimationResponse {
  payment_type: string;
  amount_ngn: number;
  from_token: string;
  token_address: Address;
  token_amount: string;
  token_amount_with_fees: string;
  platform_fee_ngn: number;
  network_fee_ngn: number;
  total_fee_ngn: number;
  gas_sponsored: boolean;
  estimated_gas: number;
}

export interface AirtimePurchaseResponse {
  id: string;
  phone_number: string;
  amount_ngn: number;
  provider: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash: Hex;
  user_op_hash?: Hex;
  flutterwave_reference?: string;
  created_at: string;
}

export interface DataPurchaseResponse {
  id: string;
  phone_number: string;
  amount_ngn: number;
  data_code: string;
  provider: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash: Hex;
  user_op_hash?: Hex;
  flutterwave_reference?: string;
  created_at: string;
}

export interface BankTransferResponse {
  id: string;
  account_number: string;
  account_name: string;
  bank_code: string;
  bank_name: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash: Hex;
  user_op_hash?: Hex;
  flutterwave_reference?: string;
  created_at: string;
}

export interface P2PTransferResponse {
  id: string;
  recipient_address: Address;
  amount_ngn: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash: Hex;
  user_op_hash?: Hex;
  created_at: string;
}

export interface PaymentHistoryResponse {
  payments: {
    id: string;
    type: string;
    amount_ngn: number;
    status: string;
    created_at: string;
  }[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// KYC API TYPES
// ============================================================================

export interface KYCVerificationResponse {
  id: string;
  user_address: Address;
  tier: 1 | 2 | 3;
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  smile_job_id?: string;
  created_at: string;
}

export interface KYCDocumentResponse {
  id: string;
  verification_id: string;
  document_type: 'nin' | 'bvn' | 'passport' | 'drivers_license' | 'selfie';
  file_url: string;
  status: 'pending' | 'verified' | 'rejected';
  uploaded_at: string;
}

export interface KYCStatusResponse {
  id: string;
  user_address: Address;
  tier: 1 | 2 | 3;
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  verification_score?: number;
  documents_verified: number;
  documents_required: number;
  can_upgrade: boolean;
  rejection_reason?: string;
  updated_at: string;
}

export interface TransactionLimitsResponse {
  tier: 1 | 2 | 3;
  daily_limit_ngn: number;
  monthly_limit_ngn: number;
  per_transaction_limit_ngn: number;
  used_today_ngn: number;
  used_this_month_ngn: number;
  remaining_today_ngn: number;
  remaining_this_month_ngn: number;
  gas_sponsorship_multiplier: number;
}

// ============================================================================
// USER API TYPES
// ============================================================================

export interface UserRegisterResponse {
  id: string;
  wallet_address: Address;
  phone_number?: string;
  email?: string;
  access_token: string;
  refresh_token: string;
  created_at: string;
}

export interface UserLoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    wallet_address: Address;
    phone_number?: string;
    email?: string;
    kyc_tier: 1 | 2 | 3;
  };
}

export interface UserProfileResponse {
  id: string;
  wallet_address: Address;
  phone_number?: string;
  email?: string;
  kyc_tier: 1 | 2 | 3;
  kyc_status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// UTILITY API TYPES
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
    blockchain: boolean;
    paymaster: boolean;
  };
}

export interface NGNRateResponse {
  rate_usd: number;
  rate_eur: number;
  rate_gbp: number;
  source: string;
  updated_at: string;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface EstimatePaymentRequest {
  payment_type: string;
  amount_ngn: number;
  from_token: string;
  network: string;
}

export interface BuyAirtimeRequest {
  phone_number: string;
  amount_ngn: number;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  from_token: string;
  blockchain_network: string;
  transaction_hash: Hex;
}

export interface BuyDataRequest {
  phone_number: string;
  amount_ngn: number;
  data_code: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  from_token: string;
  blockchain_network: string;
  transaction_hash: Hex;
}

export interface BankTransferRequest {
  account_number: string;
  account_name: string;
  bank_code: string;
  amount: number;
  from_token: string;
  blockchain_network: string;
  transaction_hash: Hex;
}

export interface P2PTransferRequest {
  recipient_address: Address;
  amount_ngn: number;
  from_token: string;
  blockchain_network: string;
  transaction_hash: Hex;
  message?: string;
}

export interface CheckGasSponsorshipRequest {
  user_address: Address;
  transaction_type: string;
  estimated_gas: number;
}
