import { create } from 'zustand';
import {
  Transaction,
  TransactionHistory,
  TransactionFilter,
  Beneficiary,
  ScheduledTransaction,
  SessionKey,
  SmartSuggestion,
  BatchTransaction,
  TransactionStatus,
  TransactionCategory,
} from '@/types/transaction';
import TransactionService from '@/services/TransactionService';

interface TransactionStore {
  // State
  transactions: Transaction[];
  scheduledTransactions: ScheduledTransaction[];
  beneficiaries: Beneficiary[];
  sessionKeys: SessionKey[];
  smartSuggestions: SmartSuggestion[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  getTransactionHistory: (filter?: TransactionFilter) => TransactionHistory;
  
  // Beneficiaries
  addBeneficiary: (beneficiary: Beneficiary) => void;
  removeBeneficiary: (id: string) => void;
  toggleFavoriteBeneficiary: (id: string) => void;
  
  // Scheduled transactions
  addScheduledTransaction: (scheduled: ScheduledTransaction) => void;
  removeScheduledTransaction: (id: string) => void;
  updateScheduledTransaction: (id: string, updates: Partial<ScheduledTransaction>) => void;
  
  // Session keys
  addSessionKey: (sessionKey: SessionKey) => void;
  revokeSessionKey: (id: string) => void;
  getActiveSessionKey: (walletId: string) => SessionKey | null;
  
  // Smart suggestions
  fetchSmartSuggestions: (walletAddress: string) => Promise<void>;
  dismissSuggestion: (id: string) => void;
  
  // Utility
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  // Initial state
  transactions: [],
  scheduledTransactions: [],
  beneficiaries: [],
  sessionKeys: [],
  smartSuggestions: [],
  isLoading: false,
  error: null,

  // Add transaction
  addTransaction: (transaction) => {
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
  },

  // Update transaction
  updateTransaction: (id, updates) => {
    set((state) => ({
      transactions: state.transactions.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx
      ),
    }));
  },

  // Get transaction history with filtering
  getTransactionHistory: (filter) => {
    const { transactions } = get();
    
    let filtered = [...transactions];

    if (filter) {
      // Filter by wallet IDs
      if (filter.walletIds && filter.walletIds.length > 0) {
        filtered = filtered.filter((tx) => filter.walletIds!.includes(tx.walletId));
      }

      // Filter by categories
      if (filter.categories && filter.categories.length > 0) {
        filtered = filtered.filter((tx) => filter.categories!.includes(tx.category));
      }

      // Filter by statuses
      if (filter.statuses && filter.statuses.length > 0) {
        filtered = filtered.filter((tx) => filter.statuses!.includes(tx.status));
      }

      // Filter by date range
      if (filter.dateFrom) {
        filtered = filtered.filter((tx) => tx.createdAt >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        filtered = filtered.filter((tx) => tx.createdAt <= filter.dateTo!);
      }

      // Filter by amount range
      if (filter.minAmount) {
        filtered = filtered.filter((tx) => tx.amount >= filter.minAmount!);
      }
      if (filter.maxAmount) {
        filtered = filtered.filter((tx) => tx.amount <= filter.maxAmount!);
      }

      // Search query (search in details)
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        filtered = filtered.filter((tx) => {
          const detailsStr = JSON.stringify(tx.details).toLowerCase();
          return detailsStr.includes(query) || tx.id.toLowerCase().includes(query);
        });
      }
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Calculate aggregates
    const totalSpent = filtered
      .filter((tx) => 
        tx.category !== TransactionCategory.CRYPTO_RECEIVE &&
        tx.status === TransactionStatus.COMPLETED
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalReceived = filtered
      .filter((tx) => 
        tx.category === TransactionCategory.CRYPTO_RECEIVE &&
        tx.status === TransactionStatus.COMPLETED
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalFees = filtered
      .filter((tx) => tx.status === TransactionStatus.COMPLETED)
      .reduce((sum, tx) => sum + tx.fees.totalFees, 0);

    const transactionsByCategory = filtered.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + 1;
      return acc;
    }, {} as Record<TransactionCategory, number>);

    const transactionsByStatus = filtered.reduce((acc, tx) => {
      acc[tx.status] = (acc[tx.status] || 0) + 1;
      return acc;
    }, {} as Record<TransactionStatus, number>);

    const page = 1;
    const pageSize = 50;
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const paginatedTransactions = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      transactions: paginatedTransactions,
      totalCount,
      page,
      pageSize,
      totalPages,
      aggregates: {
        totalSpent,
        totalReceived,
        totalFees,
        transactionsByCategory,
        transactionsByStatus,
      },
    };
  },

  // Add beneficiary
  addBeneficiary: (beneficiary) => {
    set((state) => ({
      beneficiaries: [...state.beneficiaries, beneficiary],
    }));
  },

  // Remove beneficiary
  removeBeneficiary: (id) => {
    set((state) => ({
      beneficiaries: state.beneficiaries.filter((b) => b.id !== id),
    }));
  },

  // Toggle favorite beneficiary
  toggleFavoriteBeneficiary: (id) => {
    set((state) => ({
      beneficiaries: state.beneficiaries.map((b) =>
        b.id === id ? { ...b, isFavorite: !b.isFavorite } : b
      ),
    }));
  },

  // Add scheduled transaction
  addScheduledTransaction: (scheduled) => {
    set((state) => ({
      scheduledTransactions: [...state.scheduledTransactions, scheduled],
    }));
  },

  // Remove scheduled transaction
  removeScheduledTransaction: (id) => {
    set((state) => ({
      scheduledTransactions: state.scheduledTransactions.filter((s) => s.id !== id),
    }));
  },

  // Update scheduled transaction
  updateScheduledTransaction: (id, updates) => {
    set((state) => ({
      scheduledTransactions: state.scheduledTransactions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  // Add session key
  addSessionKey: (sessionKey) => {
    set((state) => ({
      sessionKeys: [...state.sessionKeys, sessionKey],
    }));
  },

  // Revoke session key
  revokeSessionKey: (id) => {
    set((state) => ({
      sessionKeys: state.sessionKeys.map((sk) =>
        sk.id === id ? { ...sk, isActive: false } : sk
      ),
    }));
  },

  // Get active session key for wallet
  getActiveSessionKey: (walletId) => {
    const { sessionKeys } = get();
    const now = Date.now();
    
    return sessionKeys.find(
      (sk) =>
        sk.walletId === walletId &&
        sk.isActive &&
        sk.expiryTime > now &&
        sk.totalSpent < sk.permissions.maxTotalAmount
    ) || null;
  },

  // Fetch smart suggestions
  fetchSmartSuggestions: async (walletAddress) => {
    try {
      set({ isLoading: true, error: null });
      
      const suggestions = await TransactionService.getSmartSuggestions(walletAddress);
      
      set({ smartSuggestions: suggestions, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch suggestions',
        isLoading: false,
      });
    }
  },

  // Dismiss suggestion
  dismissSuggestion: (id) => {
    set((state) => ({
      smartSuggestions: state.smartSuggestions.filter((s) => s.id !== id),
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Set loading
  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
