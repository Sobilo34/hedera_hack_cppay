/**
 * CPPay Transaction Types
 * Comprehensive type definitions for all transaction operations
 */

// ============================================================================
// TRANSACTION CATEGORIES
// ============================================================================

export enum TransactionCategory {
  AIRTIME = 'airtime',
  ELECTRICITY = 'electricity',
  WATER = 'water',
  CABLE_TV = 'cable_tv',
  INTERNET = 'internet',
  EDUCATION = 'education',
  P2P_TRANSFER = 'p2p_transfer',
  CRYPTO_SEND = 'crypto_send',
  CRYPTO_RECEIVE = 'crypto_receive',
  SWAP = 'swap',
  SAVINGS = 'savings',
  BATCH = 'batch',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SCHEDULED = 'scheduled',
}

export enum TransactionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export interface PaymentToken {
  symbol: string; // USDT, ETH, BNB, etc.
  address: string; // Token contract address
  decimals: number;
  chainId: number;
  balance: string;
  balanceUSD: number;
  balanceNGN: number;
  logoUrl?: string;
}

export interface PaymentMethod {
  walletId: string;
  walletName: string;
  walletAddress: string;
  availableTokens: PaymentToken[];
  preferredToken?: PaymentToken;
  isActive: boolean;
}

// ============================================================================
// BILL PAYMENT TYPES
// ============================================================================

export enum AirtimeProvider {
  MTN = 'MTN',
  GLO = 'GLO',
  AIRTEL = 'AIRTEL',
  NINE_MOBILE = '9MOBILE',
}

export enum ElectricityProvider {
  EKEDC = 'EKEDC',
  IKEDC = 'IKEDC',
  AEDC = 'AEDC',
  PHED = 'PHED',
  JEDC = 'JEDC',
  KEDC = 'KEDC',
}

export enum CableTVProvider {
  DSTV = 'DSTV',
  GOTV = 'GOTV',
  STARTIMES = 'STARTIMES',
  SHOWMAX = 'SHOWMAX',
}

export enum InternetProvider {
  SPECTRANET = 'SPECTRANET',
  SMILE = 'SMILE',
  SWIFT = 'SWIFT',
  IPNX = 'IPNX',
}

export interface AirtimePurchase {
  provider: AirtimeProvider;
  phoneNumber: string;
  amount: number; // Amount in Naira
  amountUSD?: number;
  beneficiaryName?: string;
  saveAsBeneficiary?: boolean;
}

export interface ElectricityPurchase {
  provider: ElectricityProvider;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
  amount: number;
  customerName?: string;
  customerAddress?: string;
  saveAsBeneficiary?: boolean;
}

export interface CableTVPurchase {
  provider: CableTVProvider;
  smartCardNumber: string;
  packageId: string;
  packageName: string;
  amount: number;
  customerName?: string;
  saveAsBeneficiary?: boolean;
}

export interface InternetPurchase {
  provider: InternetProvider;
  accountNumber: string;
  planId: string;
  planName: string;
  amount: number;
  customerName?: string;
  saveAsBeneficiary?: boolean;
}

export interface WaterPurchase {
  provider: string;
  accountNumber: string;
  amount: number;
  customerName?: string;
  customerAddress?: string;
  saveAsBeneficiary?: boolean;
}

export interface EducationPayment {
  institution: string;
  studentId: string;
  studentName: string;
  purpose: 'tuition' | 'acceptance' | 'hostel' | 'other';
  amount: number;
  semester?: string;
  session?: string;
}

// ============================================================================
// TRANSFER TYPES
// ============================================================================

export interface P2PTransfer {
  recipientAddress: string; // Wallet address or ENS
  recipientName?: string;
  amount: number;
  currency: 'NGN' | 'USD' | 'crypto';
  token?: PaymentToken;
  message?: string;
  saveAsContact?: boolean;
}

export interface CryptoSend {
  recipientAddress: string;
  token: PaymentToken;
  amount: string; // In token units
  amountUSD: number;
  amountNGN: number;
  message?: string;
  priority: TransactionPriority;
}

export interface CryptoReceive {
  senderAddress: string;
  token: PaymentToken;
  amount: string;
  amountUSD: number;
  amountNGN: number;
  txHash: string;
  timestamp: number;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export interface BatchTransactionItem {
  id: string;
  category: TransactionCategory;
  description: string;
  amount: number;
  amountUSD: number;
  details:
    | AirtimePurchase
    | ElectricityPurchase
    | CableTVPurchase
    | InternetPurchase
    | WaterPurchase
    | P2PTransfer
    | CryptoSend
    | EducationPayment;
  status: TransactionStatus;
  error?: string;
}

export interface BatchTransaction {
  id: string;
  name: string; // e.g., "Monthly Bills"
  items: BatchTransactionItem[];
  totalAmount: number;
  totalAmountUSD: number;
  walletId: string;
  paymentToken: PaymentToken;
  createdAt: number;
  executedAt?: number;
  status: TransactionStatus;
}

// ============================================================================
// SCHEDULED & RECURRING PAYMENTS
// ============================================================================

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export interface ScheduledTransaction {
  id: string;
  category: TransactionCategory;
  details:
    | AirtimePurchase
    | ElectricityPurchase
    | CableTVPurchase
    | InternetPurchase
    | WaterPurchase
    | P2PTransfer
    | EducationPayment;
  scheduledDate: number; // Unix timestamp
  walletId: string;
  paymentToken: PaymentToken;
  isRecurring: boolean;
  recurrence?: {
    frequency: RecurrenceFrequency;
    endDate?: number;
    executionCount?: number;
    lastExecution?: number;
    nextExecution?: number;
  };
  isActive: boolean;
  createdAt: number;
}

// ============================================================================
// SESSION KEYS (Account Abstraction)
// ============================================================================

export interface SessionKey {
  id: string;
  publicKey: string;
  walletId: string;
  permissions: {
    maxAmountPerTx: number; // Maximum per transaction
    maxTotalAmount: number; // Maximum total spending
    allowedCategories: TransactionCategory[];
    allowedRecipients?: string[]; // Whitelist addresses
  };
  startTime: number;
  expiryTime: number;
  totalSpent: number;
  transactionCount: number;
  isActive: boolean;
  createdAt: number;
}

// ============================================================================
// TRANSACTION FEES
// ============================================================================

export interface TransactionFees {
  serviceFee: number; // CPPay service fee in NGN
  networkFee: number; // Gas fee (sponsored if gasless)
  providerFee?: number; // Bill provider fee
  totalFees: number;
  isGasSponsored: boolean;
  sponsorshipReason?: string; // e.g., "Under $50 limit"
}

// ============================================================================
// COMPREHENSIVE TRANSACTION OBJECT
// ============================================================================

export interface Transaction {
  id: string;
  hash?: string; // Blockchain transaction hash
  userOperationHash?: string; // ERC-4337 UserOp hash
  category: TransactionCategory;
  status: TransactionStatus;
  
  // Wallet info
  walletId: string;
  walletAddress: string;
  walletName: string;
  
  // Payment details
  paymentToken: PaymentToken;
  amount: number; // Amount in Naira
  amountUSD: number;
  tokenAmount: string; // Amount in token units
  
  // Transaction details
  details:
    | AirtimePurchase
    | ElectricityPurchase
    | CableTVPurchase
    | InternetPurchase
    | WaterPurchase
    | P2PTransfer
    | CryptoSend
    | CryptoReceive
    | EducationPayment
    | BatchTransaction;
  
  // Fees
  fees: TransactionFees;
  
  // Timestamps
  createdAt: number;
  completedAt?: number;
  
  // Session key (if used)
  sessionKeyId?: string;
  
  // Batch info (if part of batch)
  batchId?: string;
  batchIndex?: number;
  
  // Metadata
  reference?: string; // Provider reference
  confirmationCode?: string;
  receipt?: string; // Receipt URL
  notes?: string;
  tags?: string[];
}

// ============================================================================
// TRANSACTION HISTORY & FILTERING
// ============================================================================

export interface TransactionFilter {
  walletIds?: string[];
  categories?: TransactionCategory[];
  statuses?: TransactionStatus[];
  dateFrom?: number;
  dateTo?: number;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}

export interface TransactionHistory {
  transactions: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  aggregates: {
    totalSpent: number;
    totalReceived: number;
    totalFees: number;
    transactionsByCategory: Record<TransactionCategory, number>;
    transactionsByStatus: Record<TransactionStatus, number>;
  };
}

// ============================================================================
// BENEFICIARIES & CONTACTS
// ============================================================================

export interface Beneficiary {
  id: string;
  name: string;
  category: TransactionCategory;
  details:
    | { type: 'airtime'; provider: AirtimeProvider; phoneNumber: string }
    | { type: 'electricity'; provider: ElectricityProvider; meterNumber: string; meterType: string }
    | { type: 'cable_tv'; provider: CableTVProvider; smartCardNumber: string }
    | { type: 'internet'; provider: InternetProvider; accountNumber: string }
    | { type: 'water'; provider: string; accountNumber: string }
    | { type: 'p2p'; address: string }
    | { type: 'education'; institution: string; studentId: string };
  lastUsed?: number;
  usageCount: number;
  totalSpent: number;
  isFavorite: boolean;
  createdAt: number;
}

// ============================================================================
// SMART SUGGESTIONS
// ============================================================================

export interface SmartSuggestion {
  id: string;
  type: 'recurring_bill' | 'low_balance' | 'better_rate' | 'save_beneficiary' | 'batch_opportunity';
  title: string;
  description: string;
  action?: {
    type: 'schedule' | 'top_up' | 'switch_token' | 'save' | 'create_batch';
    data: any;
  };
  priority: number;
  expiresAt?: number;
}

// ============================================================================
// WALLET SWITCHING DURING TRANSACTION
// ============================================================================

export interface WalletSuggestion {
  walletId: string;
  walletName: string;
  walletAddress: string;
  reason: string; // e.g., "Lowest fees", "Fastest confirmation", "Sufficient balance"
  availableTokens: PaymentToken[];
  estimatedFees: TransactionFees;
  estimatedTime: number; // Seconds
  score: number; // 0-100
}

// ============================================================================
// TRANSACTION ANALYTICS
// ============================================================================

export interface TransactionAnalytics {
  period: 'day' | 'week' | 'month' | 'year';
  totalSpent: number;
  totalReceived: number;
  transactionCount: number;
  averageTransaction: number;
  topCategories: Array<{
    category: TransactionCategory;
    amount: number;
    count: number;
    percentage: number;
  }>;
  topBeneficiaries: Array<{
    beneficiary: Beneficiary;
    amount: number;
    count: number;
  }>;
  savingsOpportunities: Array<{
    description: string;
    potentialSaving: number;
    action: string;
  }>;
  spendingTrends: Array<{
    date: number;
    amount: number;
    category: TransactionCategory;
  }>;
}

// ============================================================================
// PAYMASTER & GAS SPONSORSHIP
// ============================================================================

export interface GasSponsorshipPolicy {
  isEligible: boolean;
  reason?: string;
  maxSponsoredAmount: number;
  currentUsage: number;
  resetDate: number;
  conditions: string[];
}

// ============================================================================
// SOCIAL RECOVERY FOR TRANSACTIONS
// ============================================================================

export interface RecoveryRequest {
  id: string;
  walletId: string;
  requestedBy: string;
  guardians: Array<{
    address: string;
    name: string;
    hasApproved: boolean;
    approvedAt?: number;
  }>;
  requiredApprovals: number;
  currentApprovals: number;
  status: 'pending' | 'approved' | 'cancelled' | 'executed';
  executionDate?: number; // After 48hr delay
  createdAt: number;
}
