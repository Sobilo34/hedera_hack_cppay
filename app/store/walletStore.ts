import { create } from 'zustand';
import {
  AppState,
  TokenBalance,
  Transaction,
  NetworkConfig,
  PriceData,
} from '@/types/wallet';
import WalletService from '@/services/WalletService';
import PriceService from '@/services/PriceService';
import SecureWalletStorage from '@/services/SecureWalletStorage';
import SmartAccountService, { SmartAccountInfo } from '@/services/SmartAccountService';
import BackendApiService from '@/services/BackendApiService';

interface WalletStore extends AppState {
  // Backend auth state
  backendAuth: {
    jwtToken: string | null;
    userId: string | null;
    isRegistered: boolean;
  };
  
  // Smart account state
  smartAccount: {
    address: string | null;
    isDeployed: boolean;
    isInitializing: boolean;
    error: string | null;
  };
  
  // Actions
  initialize: () => Promise<void>;
  createWallet: (mnemonic: string, passwordOrPin: string, isPin?: boolean) => Promise<void>;
  importWallet: (mnemonicOrKey: string, passwordOrPin: string, isPrivateKey?: boolean, isPin?: boolean) => Promise<void>;
  unlockWallet: (passwordOrPin: string, isPin?: boolean) => Promise<boolean>;
  lockWallet: () => void;
  deleteWallet: () => Promise<void>;
  
  // Backend auth actions
  registerWithBackend: (email: string, password: string, phoneNumber?: string) => Promise<void>;
  registerWalletsWithBackend: () => Promise<any[]>;
  
  // Smart Account actions  
  generateSmartAccounts: () => Promise<SmartAccountInfo[]>;
  getSmartAccountAddress: (chainId: number) => Promise<string | null>;
  initializeSmartAccount: (privateKey: string, chainId?: number) => Promise<void>;
  refreshSmartAccountStatus: () => Promise<void>;
  getSmartAccountInfo: () => { address: string | null; isDeployed: boolean };
  
  // Balance actions
  fetchBalances: () => Promise<void>;
  updatePrices: () => Promise<void>;
  calculateTotalBalance: () => void;
  
  // Transaction actions
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  
  // Network actions
  setActiveNetwork: (chainId: number) => void;
  toggleNetwork: (chainId: number, enabled: boolean) => void;
  
  // Preferences
  setCurrency: (currency: 'NGN' | 'USD') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setBiometric: (enabled: boolean) => Promise<void>;
  setAutoLockDuration: (duration: number) => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  // Initial state
  auth: {
    isAuthenticated: false,
    biometricEnabled: false,
    lastUnlockTime: 0,
    autoLockDuration: 5 * 60 * 1000, // 5 minutes
    hasWallet: false,
  },
  
  // Backend auth state
  backendAuth: {
    jwtToken: null,
    userId: null,
    isRegistered: false,
  },
  
  // Smart account state
  smartAccount: {
    address: null,
    isDeployed: false,
    isInitializing: false,
    error: null,
  },
  
  wallet: {
    address: null,
    mnemonic: null,
    privateKey: null,
    isLocked: true,
    networks: WalletService.DEFAULT_NETWORKS,
    activeNetwork: 1, // Ethereum mainnet
    smartAccountAddress: null,
    isSmartAccountDeployed: false,
  },
  
  balances: {
    tokens: [],
    totalNGN: 0,
    totalUSD: 0,
    lastUpdated: 0,
    loading: false,
  },
  
  transactions: [],
  
  prices: {
    rates: {},
    ngnUsdRate: 1600,
    lastUpdated: 0,
  },
  
  preferences: {
    currency: 'NGN',
    language: 'en',
    theme: 'light',
    notifications: true,
    defaultGasSpeed: 'normal',
  },

  // Initialize app state
  initialize: async () => {
    try {
      console.log('🔄 Starting wallet store initialization...');
      
      // Check if wallet exists
      const hasWallet = await SecureWalletStorage.hasWallet();
      console.log('📱 Has wallet:', hasWallet);
      
      const biometricEnabled = await SecureWalletStorage.isBiometricEnabled();
      console.log('👆 Biometric enabled:', biometricEnabled);
      
      const address = await SecureWalletStorage.getAddress();
      console.log('📍 Wallet address:', address || 'none');

      // Load smart account data
      const smartAccountAddress = await SecureWalletStorage.getSmartAccountAddress();
      const isSmartAccountDeployed = await SecureWalletStorage.isSmartAccountDeployed();
      console.log('🔧 Smart account address:', smartAccountAddress || 'none');
      console.log('✅ Smart account deployed:', isSmartAccountDeployed);

      set((state) => ({
        auth: {
          ...state.auth,
          hasWallet,
          biometricEnabled,
        },
        wallet: {
          ...state.wallet,
          address,
          isLocked: hasWallet,
          smartAccountAddress,
          isSmartAccountDeployed,
        },
      }));

      console.log('✅ Wallet store initialized successfully');

      // Fetch prices if wallet exists
      if (hasWallet) {
        console.log('💰 Fetching prices...');
        await get().updatePrices();
      }
    } catch (error) {
      console.error('❌ Failed to initialize wallet store:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      
      // Set default state even if initialization fails
      set((state) => ({
        auth: {
          ...state.auth,
          hasWallet: false,
          biometricEnabled: false,
        },
        wallet: {
          ...state.wallet,
          address: null,
          isLocked: false,
          smartAccountAddress: null,
          isSmartAccountDeployed: false,
        },
      }));
    }
  },

  // Create new wallet
  createWallet: async (mnemonic: string, passwordOrPin: string, isPin = false) => {
    try {
      const walletData = WalletService.createWalletFromMnemonic(mnemonic);

      // Store wallet data securely
      await SecureWalletStorage.storeMnemonic(mnemonic, passwordOrPin);
      await SecureWalletStorage.storePrivateKey(walletData.privateKey, passwordOrPin);
      await SecureWalletStorage.storeAddress(walletData.address);
      
      // Store authentication method
      if (isPin) {
        await SecureWalletStorage.storePasswordHash(passwordOrPin); // Store PIN hash
      } else {
        await SecureWalletStorage.storePasswordHash(passwordOrPin);
      }

      set((state) => ({
        auth: {
          ...state.auth,
          isAuthenticated: true,
          hasWallet: true,
          lastUnlockTime: Date.now(),
        },
        wallet: {
          ...state.wallet,
          address: walletData.address,
          isLocked: false,
        },
      }));

      // Generate smart accounts for all networks
      await get().generateSmartAccounts();

      // Fetch initial balances
      await get().fetchBalances();
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw error;
    }
  },

  // Generate smart accounts for all networks
  generateSmartAccounts: async () => {
    const state = get();
    if (!state.wallet.address) {
      throw new Error('No wallet address found');
    }

    try {
      console.log('🔧 Generating smart accounts for all networks...');
      
      const smartAccounts = await SmartAccountService.generateSmartAccountsAllNetworks(
        state.wallet.address
      );

      // Store the primary smart account (Lisk Sepolia for testing)
      const primarySmartAccount = smartAccounts.find(sa => sa.chainId === 4202) || smartAccounts[0];
      
      if (primarySmartAccount) {
        // Store in state
        set((state) => ({
          wallet: {
            ...state.wallet,
            smartAccountAddress: primarySmartAccount.address,
            isSmartAccountDeployed: primarySmartAccount.isDeployed,
          },
        }));

        // Persist smart account addresses in secure storage
        await SecureWalletStorage.storeSmartAccountAddress(primarySmartAccount.address);
        await SecureWalletStorage.setSmartAccountDeployed(primarySmartAccount.isDeployed);
        
        // Store all smart accounts for network-specific retrieval
        await SecureWalletStorage.setItem('smart_accounts', JSON.stringify(smartAccounts));
      }

      console.log(`✅ Generated ${smartAccounts.length} smart accounts`);
      return smartAccounts;
    } catch (error) {
      console.error('❌ Failed to generate smart accounts:', error);
      throw error;
    }
  },

  // Get smart account address for specific network
  getSmartAccountAddress: async (chainId: number) => {
    try {
      const smartAccountsJson = await SecureWalletStorage.getItem('smart_accounts');
      if (!smartAccountsJson) return null;

      const smartAccounts = JSON.parse(smartAccountsJson);
      const account = smartAccounts.find((sa: any) => sa.chainId === chainId);
      return account?.address || null;
    } catch (error) {
      console.error('Failed to get smart account address:', error);
      return null;
    }
  },

  // Initialize smart account (legacy method, now calls generateSmartAccounts)
  initializeSmartAccount: async (privateKey: string, chainId = 4202) => {
    try {
      console.log('🔧 Initializing smart account...');
      await get().generateSmartAccounts();
      console.log('✅ Smart account initialized');
    } catch (error) {
      console.error('❌ Failed to initialize smart account:', error);
      throw error;
    }
  },

  // Get smart account info
  getSmartAccountInfo: () => {
    const state = get();
    return {
      address: state.wallet.smartAccountAddress,
      isDeployed: state.wallet.isSmartAccountDeployed,
    };
  },

  // Register user with backend
  registerWithBackend: async (email: string, password: string, phoneNumber?: string) => {
    try {
      console.log('📡 Registering user with backend...');
      
      const response = await BackendApiService.register({
        email,
        password,
        phone_number: phoneNumber,
      });
      
      console.log('✅ User registered with backend');
      
      // Login to get tokens
      const loginResponse = await BackendApiService.login({ email, password });
      
      set((state) => ({
        backendAuth: {
          jwtToken: loginResponse.access_token,
          userId: email, // Use email as user ID
          isRegistered: true,
        },
      }));
      
      console.log('✅ Backend authentication complete');
    } catch (error) {
      console.error('❌ Backend registration failed:', error);
      throw error;
    }
  },

  // Register wallets with backend for all networks
  registerWalletsWithBackend: async () => {
    const state = get();
    
    if (!state.backendAuth.isRegistered || !state.wallet.address) {
      throw new Error('User must be registered and have wallet before registering wallets');
    }

    try {
      console.log('📡 Registering wallets with backend...');
      
      const results = await BackendApiService.registerWalletAllNetworks(
        state.wallet.address,
        state.wallet.smartAccountAddress || undefined
      );
      
      console.log(`✅ Registered wallet on ${results.filter(r => r.success).length} networks`);
      return results;
    } catch (error) {
      console.error('❌ Failed to register wallets with backend:', error);
      throw error;
    }
  },

  // Refresh smart account status
  refreshSmartAccountStatus: async () => {
    try {
      const state = get();
      if (!state.wallet.smartAccountAddress) {
        console.log('No smart account address to refresh');
        return;
      }

      console.log('🔄 Refreshing smart account status...');
      
      set((prevState) => ({
        smartAccount: {
          ...prevState.smartAccount,
          isInitializing: true,
          error: null,
        },
      }));

      // TODO: Check deployment status when AccountAbstractionService is ready
      // const AccountAbstractionService = await import('@/services/AccountAbstractionService').then(m => m.default);
      // const isDeployed = await AccountAbstractionService.isAccountDeployed(state.wallet.smartAccountAddress);
      
      set((prevState) => ({
        smartAccount: {
          address: state.wallet.smartAccountAddress,
          isDeployed: state.wallet.isSmartAccountDeployed,
          isInitializing: false,
          error: null,
        },
      }));

      console.log('✅ Smart account status refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh smart account status:', error);
      
      set((prevState) => ({
        smartAccount: {
          ...prevState.smartAccount,
          isInitializing: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    }
  },

  // Import existing wallet
  importWallet: async (mnemonicOrKey: string, passwordOrPin: string, isPrivateKey = false, isPin = false) => {
    try {
      let walletData: { address: string; privateKey: string; mnemonic?: string };

      if (isPrivateKey) {
        walletData = WalletService.importWalletFromPrivateKey(mnemonicOrKey);
        await SecureWalletStorage.storePrivateKey(walletData.privateKey, passwordOrPin);
      } else {
        walletData = WalletService.createWalletFromMnemonic(mnemonicOrKey);
        await SecureWalletStorage.storeMnemonic(mnemonicOrKey, passwordOrPin);
        await SecureWalletStorage.storePrivateKey(walletData.privateKey, passwordOrPin);
      }

      await SecureWalletStorage.storeAddress(walletData.address);
      
      // Store authentication method
      if (isPin) {
        await SecureWalletStorage.storePasswordHash(passwordOrPin); // Store PIN hash
      } else {
        await SecureWalletStorage.storePasswordHash(passwordOrPin);
      }

      set((state) => ({
        auth: {
          ...state.auth,
          isAuthenticated: true,
          hasWallet: true,
          lastUnlockTime: Date.now(),
        },
        wallet: {
          ...state.wallet,
          address: walletData.address,
          isLocked: false,
        },
      }));

      // Generate smart accounts for all networks
      await get().generateSmartAccounts();

      // Fetch initial balances
      await get().fetchBalances();
    } catch (error) {
      console.error('Failed to import wallet:', error);
      throw error;
    }
  },

  // Unlock wallet with password or PIN
  unlockWallet: async (passwordOrPin: string, isPin = false) => {
    try {
      // If passwordOrPin is empty, check for valid biometric session
      if (!passwordOrPin || passwordOrPin === '') {
        const isSessionValid = await SecureWalletStorage.isSessionValid();
        if (isSessionValid) {
          // Biometric unlock - just restore session
          set((state) => ({
            auth: {
              ...state.auth,
              isAuthenticated: true,
              lastUnlockTime: Date.now(),
            },
            wallet: {
              ...state.wallet,
              isLocked: false,
            },
          }));

          // Mark session as valid
          await SecureWalletStorage.setSessionValid(true);

          // Fetch latest balances
          await get().fetchBalances();
          
          return true;
        }
        return false;
      }

      // Verify PIN/password
      const isValid = await SecureWalletStorage.verifyPassword(passwordOrPin);
      
      if (!isValid) {
        return false;
      }

      set((state) => ({
        auth: {
          ...state.auth,
          isAuthenticated: true,
          lastUnlockTime: Date.now(),
        },
        wallet: {
          ...state.wallet,
          isLocked: false,
        },
      }));

      // Mark session as valid for biometric
      await SecureWalletStorage.setSessionValid(true);

      // Fetch latest balances
      await get().fetchBalances();
      
      return true;
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      return false;
    }
  },

  // Lock wallet
  lockWallet: () => {
    // Invalidate session
    SecureWalletStorage.setSessionValid(false);
    
    set((state) => ({
      auth: {
        ...state.auth,
        isAuthenticated: false,
      },
      wallet: {
        ...state.wallet,
        isLocked: true,
      },
    }));
  },

  // Delete wallet (dangerous!)
  deleteWallet: async () => {
    try {
      await SecureWalletStorage.deleteWallet();
      
      // Reset to initial state
      set({
        auth: {
          isAuthenticated: false,
          biometricEnabled: false,
          lastUnlockTime: 0,
          autoLockDuration: 5 * 60 * 1000,
          hasWallet: false,
        },
        wallet: {
          address: null,
          mnemonic: null,
          privateKey: null,
          isLocked: true,
          networks: WalletService.DEFAULT_NETWORKS,
          activeNetwork: 1,
          smartAccountAddress: null,
          isSmartAccountDeployed: false,
        },
        balances: {
          tokens: [],
          totalNGN: 0,
          totalUSD: 0,
          lastUpdated: 0,
          loading: false,
        },
        transactions: [],
        prices: {
          rates: {},
          ngnUsdRate: 1600,
          lastUpdated: 0,
        },
        preferences: {
          currency: 'NGN',
          language: 'en',
          theme: 'light',
          notifications: true,
          defaultGasSpeed: 'normal',
        },
      });
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      throw error;
    }
  },

  // Fetch token balances
  fetchBalances: async () => {
    const state = get();
    const { address } = state.wallet;
    
    if (!address) return;

    set((state) => ({
      balances: { ...state.balances, loading: true },
    }));

    try {
      // Fetch prices first
      await get().updatePrices();

      // Create prices map
      const pricesMap: { [symbol: string]: { usd: number; ngn: number } } = {};
      Object.entries(state.prices.rates).forEach(([symbol, data]) => {
        pricesMap[symbol] = { usd: data.usd, ngn: data.ngn };
      });

      // Fetch balances across all networks
      const balances = await WalletService.fetchAllBalances(
        address,
        state.wallet.networks,
        pricesMap
      );

      set((state) => ({
        balances: {
          ...state.balances,
          tokens: balances,
          loading: false,
          lastUpdated: Date.now(),
        },
      }));

      // Calculate total balance
      get().calculateTotalBalance();
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      set((state) => ({
        balances: { ...state.balances, loading: false },
      }));
    }
  },

  // Update cryptocurrency prices
  updatePrices: async () => {
    try {
      const symbols = ['ETH', 'BTC', 'BNB', 'USDT', 'USDC', 'MATIC'];
      const prices = await PriceService.fetchMultiplePrices(symbols);
      const ngnRate = await PriceService.fetchNGNRate();

      const rates: { [symbol: string]: PriceData } = {};
      Object.entries(prices).forEach(([symbol, data]) => {
        rates[symbol] = data;
      });

      set((state) => ({
        prices: {
          rates,
          ngnUsdRate: ngnRate,
          lastUpdated: Date.now(),
        },
      }));
    } catch (error) {
      console.error('Failed to update prices:', error);
    }
  },

  // Calculate total portfolio balance
  calculateTotalBalance: () => {
    const state = get();
    let totalNGN = 0;
    let totalUSD = 0;

    state.balances.tokens.forEach((token) => {
      const balance = parseFloat(token.balance);
      totalNGN += balance * token.priceNgn;
      totalUSD += balance * token.priceUsd;
    });

    set((state) => ({
      balances: {
        ...state.balances,
        totalNGN,
        totalUSD,
      },
    }));
  },

  // Add transaction to history
  addTransaction: (transaction: Transaction) => {
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
  },

  // Update existing transaction
  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    set((state) => ({
      transactions: state.transactions.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx
      ),
    }));
  },

  // Set active network
  setActiveNetwork: (chainId: number) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        activeNetwork: chainId,
      },
    }));
  },

  // Toggle network enabled/disabled
  toggleNetwork: (chainId: number, enabled: boolean) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        networks: state.wallet.networks.map((network) =>
          network.chainId === chainId ? { ...network, enabled } : network
        ),
      },
    }));
  },

  // Set display currency
  setCurrency: (currency: 'NGN' | 'USD') => {
    set((state) => ({
      preferences: {
        ...state.preferences,
        currency,
      },
    }));
  },

  // Set theme
  setTheme: (theme: 'light' | 'dark') => {
    set((state) => ({
      preferences: {
        ...state.preferences,
        theme,
      },
    }));
  },

  // Enable/disable biometric authentication
  setBiometric: async (enabled: boolean) => {
    try {
      await SecureWalletStorage.setBiometricEnabled(enabled);
      set((state) => ({
        auth: {
          ...state.auth,
          biometricEnabled: enabled,
        },
      }));
    } catch (error) {
      console.error('Failed to set biometric:', error);
      throw error;
    }
  },

  // Set auto-lock duration
  setAutoLockDuration: (duration: number) => {
    set((state) => ({
      auth: {
        ...state.auth,
        autoLockDuration: duration,
      },
    }));
  },
}));
