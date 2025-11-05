// Wallet Types for CPPay Hybrid Crypto-Fiat Wallet

export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  iconUrl: string;
  enabled: boolean;
  isTestnet?: boolean;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  chain: string;
  contractAddress?: string;
  logoUrl: string;
  priceUsd: number;
  priceNgn: number;
  chainId: number;
}

export interface PriceData {
  usd: number;
  ngn: number;
  change24h: number;
  lastUpdated: number;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'airtime' | 'bank' | 'electricity' | 'data' | 'tv';
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  cryptoAmount?: number;
  cryptoSymbol?: string;
  ngnAmount?: number;
  from?: string;
  to?: string;
  hash?: string;
  swapTxHash?: string;
  fiatReference?: string;
  details?: any;
  gasUsed?: string;
  gasCost?: string;
}

export interface WalletState {
  address: string | null;
  mnemonic: string | null; // Encrypted
  privateKey: string | null; // Encrypted
  isLocked: boolean;
  networks: NetworkConfig[];
  activeNetwork: number; // chainId
  smartAccountAddress: string | null; // ERC-4337 smart account address
  isSmartAccountDeployed: boolean; // Whether the smart account is deployed on-chain
}

export interface BalanceState {
  tokens: TokenBalance[];
  totalNGN: number;
  totalUSD: number;
  lastUpdated: number;
  loading: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  lastUnlockTime: number;
  autoLockDuration: number; // in milliseconds
  hasWallet: boolean;
}

export interface PriceState {
  rates: { [symbol: string]: PriceData };
  ngnUsdRate: number;
  lastUpdated: number;
}

export interface PreferencesState {
  currency: 'NGN' | 'USD';
  language: 'en';
  theme: 'light' | 'dark';
  notifications: boolean;
  defaultGasSpeed: 'slow' | 'normal' | 'fast';
}

export interface AppState {
  auth: AuthState;
  wallet: WalletState;
  balances: BalanceState;
  transactions: Transaction[];
  prices: PriceState;
  preferences: PreferencesState;
}

// Fiat Payment Types
export interface AirtimeRequest {
  phone: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  amount: number;
}

export interface BankTransferRequest {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  amount: number;
  narration?: string;
}

export interface ElectricityRequest {
  disco: string;
  meterNumber: string;
  amount: number;
  meterType: 'prepaid' | 'postpaid';
  phone: string;
}

export interface DataRequest {
  phone: string;
  network: string;
  dataCode: string;
  amount: number;
}

export interface SwapQuote {
  amountOut: string;
  priceImpact: string;
  route: any;
  gasCostUSD: string;
  minimumReceived: string;
  exchangeRate: string;
}

export interface PaymentResult {
  success: boolean;
  swapTxHash?: string | null;
  fiatReference?: string;
  cryptoSpent: number;
  ngnSpent: number;
  error?: string;
}

// Bank Information
export interface BankInfo {
  name: string;
  code: string;
  logo?: string;
}

export interface AccountVerification {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  verified: boolean;
}
