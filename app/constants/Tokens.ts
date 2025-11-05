/**
 * Token and Network Configuration for CPPay
 * 
 * SUPPORTED TOKENS (4 Essential Tokens):
 * 1. ETH (Ethereum) - Native token on Ethereum networks
 * 2. LSK (Lisk) - Native token on Lisk networks
 * 3. USDC (USD Coin) - USD stablecoin
 * 4. USDT (Tether) - USD stablecoin
 * 
 * SUPPORTED NETWORKS:
 * Mainnets: Ethereum (1), Lisk (1135)
 * Testnets: Sepolia (11155111), Lisk Sepolia (4202)
 */

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
  isNative: boolean;
  addresses: {
    [chainId: number]: string;
  };
}

export interface Network {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
  isTestnet: boolean;
  isCustom: boolean;
  logoUrl?: string;
}

// Default Networks
export const DEFAULT_NETWORKS: Network[] = [
  // Mainnets
  {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    isTestnet: false,
    isCustom: false,
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    chainId: 1135,
    name: 'Lisk',
    shortName: 'Lisk',
    rpcUrl: 'https://rpc.api.lisk.com',
    blockExplorer: 'https://blockscout.lisk.com',
    nativeCurrency: { symbol: 'LSK', name: 'Lisk', decimals: 18 },
    isTestnet: false,
    isCustom: false,
    logoUrl: 'https://assets.coingecko.com/coins/images/385/small/Lisk_Symbol.png',
  },
  
  // Testnets
  {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { symbol: 'ETH', name: 'Sepolia Ether', decimals: 18 },
    isTestnet: true,
    isCustom: false,
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    chainId: 4202,
    name: 'Lisk Sepolia Testnet',
    shortName: 'Lisk Sepolia',
    rpcUrl: 'https://rpc.sepolia-api.lisk.com',
    blockExplorer: 'https://sepolia-blockscout.lisk.com',
    nativeCurrency: { symbol: 'LSK', name: 'Lisk', decimals: 18 },
    isTestnet: true,
    isCustom: false,
    logoUrl: 'https://assets.coingecko.com/coins/images/385/small/Lisk_Symbol.png',
  },
];

// Default Tokens - 4 Essential Tokens Only
export const DEFAULT_TOKENS: Token[] = [
  // ETH - Ethereum
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    isNative: true,
    addresses: {
      1: '0x0000000000000000000000000000000000000000',      // Ethereum Mainnet (native)
      11155111: '0x0000000000000000000000000000000000000000', // Sepolia Testnet (native)
    },
  },
  
  // LSK - Lisk
  {
    symbol: 'LSK',
    name: 'Lisk',
    decimals: 18,
    logoUrl: 'https://assets.coingecko.com/coins/images/385/small/Lisk_Symbol.png',
    isNative: true,
    addresses: {
      1135: '0x0000000000000000000000000000000000000000', // Lisk Mainnet (native)
      4202: '0x0000000000000000000000000000000000000000', // Lisk Sepolia Testnet (native)
    },
  },
  
  // USDC - USD Coin
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    isNative: false,
    addresses: {
      // Mainnets
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum Mainnet
      1135: '0x05D032ac25d322df992303dCa074EE7392C117b9', // Lisk Mainnet
      // Testnets
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
      4202: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',     // Lisk Sepolia
    },
  },
  
  // USDT - Tether USD
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    isNative: false,
    addresses: {
      // Mainnets
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',    // Ethereum Mainnet
      1135: '0x0Ae38f7E10A43B5b2fB064B42a2f4514cbA909ef', // Lisk Mainnet
      // Testnets
      11155111: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Sepolia
      4202: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',     // Lisk Sepolia
    },
  },
];

/**
 * Get tokens available on a specific network
 */
export function getTokensForNetwork(chainId: number): Token[] {
  return DEFAULT_TOKENS.filter(token => 
    token.addresses[chainId] !== undefined
  );
}

/**
 * Get native token for a network
 */
export function getNativeToken(chainId: number): Token | undefined {
  return DEFAULT_TOKENS.find(token => 
    token.isNative && token.addresses[chainId] !== undefined
  );
}

/**
 * Get network by chain ID
 */
export function getNetworkByChainId(chainId: number): Network | undefined {
  return DEFAULT_NETWORKS.find(network => network.chainId === chainId);
}

/**
 * Get all mainnet networks
 */
export function getMainnetNetworks(): Network[] {
  return DEFAULT_NETWORKS.filter(network => !network.isTestnet && !network.isCustom);
}

/**
 * Get all testnet networks
 */
export function getTestnetNetworks(): Network[] {
  return DEFAULT_NETWORKS.filter(network => network.isTestnet && !network.isCustom);
}

/**
 * Check if a token is available on a specific network
 */
export function isTokenAvailableOnNetwork(tokenSymbol: string, chainId: number): boolean {
  const token = DEFAULT_TOKENS.find(t => t.symbol === tokenSymbol);
  if (!token) return false;
  
  return token.addresses[chainId] !== undefined;
}

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol: string): Token | undefined {
  return DEFAULT_TOKENS.find(token => token.symbol === symbol);
}