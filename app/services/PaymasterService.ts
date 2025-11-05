/**
 * PaymasterService - Gas Sponsorship via CPPayPaymaster Contract
 * 
 * Integrates with CPPayPaymaster deployed on Lisk network to provide:
 * - Daily gas allowance (1 ETH per day for standard users, 2 ETH for verified)
 * - Automatic paymaster data inclusion in UserOperations
 * - Graceful fallback to user-paid gas when limit exceeded
 * - Real-time gas allowance tracking
 * 
 * Smart Contract: CPPayPaymaster.sol
 * Network: Lisk Mainnet (1135) & Lisk Sepolia (4202)
 */

import { createPublicClient, http, formatEther, parseEther, Address, Hex } from 'viem';
import { lisk, liskSepolia } from 'viem/chains';
import type { UserOperation } from './smartAccount/types';

// CPPayPaymaster ABI (only functions we need)
const PAYMASTER_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getRemainingDailyGas',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'userGasData',
    outputs: [
      { name: 'gasUsedToday', type: 'uint256' },
      { name: 'lastResetTime', type: 'uint256' },
      { name: 'isVerified', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DAILY_GAS_LIMIT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifiedUserMultiplier',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paymasterActive',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paymasterDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Gas allowance status for UI display
 */
export interface GasAllowanceStatus {
  remaining: bigint; // Remaining gas in wei
  limit: bigint; // Daily limit in wei
  used: bigint; // Gas used today in wei
  resetTime: number; // Unix timestamp when allowance resets
  isVerified: boolean; // Whether user is KYC verified
  percentUsed: number; // 0-100
  canSponsor: boolean; // Whether paymaster can sponsor next transaction
  paymasterActive: boolean; // Whether paymaster contract is active
  paymasterBalance: bigint; // Paymaster's EntryPoint deposit
}

/**
 * Gas sponsorship check result
 */
export interface GasSponsorshipCheck {
  canSponsor: boolean;
  reason?: string;
  remainingGas?: bigint;
  estimatedGas?: bigint;
}

/**
 * Paymaster configuration per chain
 */
interface PaymasterConfig {
  address: Address;
  rpcUrl: string;
  chain: any; // viem chain object
  entryPoint: Address;
}

/**
 * Cache entry for gas allowance data
 */
interface CacheEntry {
  data: GasAllowanceStatus;
  timestamp: number;
}

/**
 * PaymasterService - Manages gas sponsorship via CPPayPaymaster
 */
class PaymasterService {
  private static instance: PaymasterService;
  
  // Paymaster contract addresses (deployed on Lisk networks)
  private static readonly PAYMASTER_ADDRESSES: Record<number, Address> = {
    1135: '0x0000000000000000000000000000000000000000' as Address, // TODO: Replace with actual Lisk mainnet address
    4202: '0x0000000000000000000000000000000000000000' as Address, // TODO: Replace with actual Lisk Sepolia address
  };
  
  // EntryPoint address (ERC-4337 v0.6)
  private static readonly ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
  
  // Cache configuration
  private static readonly CACHE_DURATION = 30 * 1000; // 30 seconds
  private cache: Map<string, CacheEntry> = new Map();
  
  // Singleton
  private constructor() {}
  
  static getInstance(): PaymasterService {
    if (!PaymasterService.instance) {
      PaymasterService.instance = new PaymasterService();
    }
    return PaymasterService.instance;
  }
  
  /**
   * Get paymaster configuration for chain
   */
  private getPaymasterConfig(chainId: number): PaymasterConfig | null {
    const address = PaymasterService.PAYMASTER_ADDRESSES[chainId];
    if (!address) return null;
    
    switch (chainId) {
      case 1135: // Lisk Mainnet
        return {
          address,
          rpcUrl: 'https://rpc.api.lisk.com',
          chain: lisk,
          entryPoint: PaymasterService.ENTRYPOINT_ADDRESS,
        };
      case 4202: // Lisk Sepolia
        return {
          address,
          rpcUrl: 'https://rpc.sepolia-api.lisk.com',
          chain: liskSepolia,
          entryPoint: PaymasterService.ENTRYPOINT_ADDRESS,
        };
      default:
        return null;
    }
  }
  
  /**
   * Create viem client for chain
   */
  private createClient(config: PaymasterConfig) {
    return createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
  }
  
  /**
   * Get cache key
   */
  private getCacheKey(userAddress: string, chainId: number): string {
    return `${userAddress.toLowerCase()}_${chainId}`;
  }
  
  /**
   * Get cached data if valid
   */
  private getCachedData(userAddress: string, chainId: number): GasAllowanceStatus | null {
    const key = this.getCacheKey(userAddress, chainId);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > PaymasterService.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set cached data
   */
  private setCachedData(userAddress: string, chainId: number, data: GasAllowanceStatus): void {
    const key = this.getCacheKey(userAddress, chainId);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Clear cache for user
   */
  clearCache(userAddress?: string, chainId?: number): void {
    if (userAddress && chainId) {
      const key = this.getCacheKey(userAddress, chainId);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Get user's remaining daily gas allowance
   * 
   * @param userAddress - User's smart account address
   * @param chainId - Chain ID (1135 for Lisk, 4202 for Lisk Sepolia)
   * @returns Gas allowance status with remaining, limit, and reset time
   */
  async getRemainingDailyGas(
    userAddress: string,
    chainId: number
  ): Promise<GasAllowanceStatus> {
    console.log(`📊 Getting gas allowance for ${userAddress} on chain ${chainId}`);
    
    // Check cache first
    const cached = this.getCachedData(userAddress, chainId);
    if (cached) {
      console.log('✅ Returning cached gas allowance');
      return cached;
    }
    
    // Get paymaster config
    const config = this.getPaymasterConfig(chainId);
    if (!config) {
      throw new Error(`Paymaster not available on chain ${chainId}. Only Lisk (1135) and Lisk Sepolia (4202) supported.`);
    }
    
    try {
      const client = this.createClient(config);
      
      // Parallel contract reads for efficiency
      const [
        remainingGas,
        userData,
        dailyLimit,
        multiplier,
        isActive,
        paymasterBalance,
      ] = await Promise.all([
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'getRemainingDailyGas',
          args: [userAddress as Address],
        }),
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'userGasData',
          args: [userAddress as Address],
        }),
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'DAILY_GAS_LIMIT',
        }),
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'verifiedUserMultiplier',
        }),
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'paymasterActive',
        }),
        client.readContract({
          address: config.address,
          abi: PAYMASTER_ABI,
          functionName: 'paymasterDeposit',
        }),
      ]);
      
      const [gasUsedToday, lastResetTime, isVerified] = userData as [bigint, bigint, boolean];
      
      // Calculate user's daily limit
      const userLimit = isVerified
        ? (dailyLimit as bigint) * (multiplier as bigint)
        : (dailyLimit as bigint);
      
      // Calculate reset time (24 hours from last reset)
      const ONE_DAY = 24 * 60 * 60; // 24 hours in seconds
      const resetTime = Number(lastResetTime) + ONE_DAY;
      
      // Check if reset is due (should be handled on-chain, but check here too)
      const now = Math.floor(Date.now() / 1000);
      const isResetDue = now >= resetTime;
      
      const used = isResetDue ? 0n : gasUsedToday;
      const remaining = isResetDue ? userLimit : (remainingGas as bigint);
      
      // Calculate percentage used
      const percentUsed = userLimit > 0n
        ? Math.min(100, Number((used * 100n) / userLimit))
        : 0;
      
      // Check if can sponsor (has remaining gas AND paymaster is active)
      const canSponsor = remaining > 0n && (isActive as boolean);
      
      const status: GasAllowanceStatus = {
        remaining,
        limit: userLimit,
        used,
        resetTime,
        isVerified: isVerified as boolean,
        percentUsed,
        canSponsor,
        paymasterActive: isActive as boolean,
        paymasterBalance: paymasterBalance as bigint,
      };
      
      // Cache the result
      this.setCachedData(userAddress, chainId, status);
      
      console.log('✅ Gas allowance fetched:', {
        remaining: formatEther(remaining),
        limit: formatEther(userLimit),
        percentUsed,
        canSponsor,
      });
      
      return status;
    } catch (error: any) {
      console.error('❌ Failed to get gas allowance:', error);
      throw new Error(`Failed to fetch gas allowance: ${error.message}`);
    }
  }
  
  /**
   * Check if paymaster can sponsor a transaction
   * 
   * @param userAddress - User's smart account address
   * @param estimatedGas - Estimated gas cost in wei
   * @param chainId - Chain ID
   * @returns Sponsorship check result
   */
  async checkGasSponsorship(
    userAddress: string,
    estimatedGas: bigint,
    chainId: number
  ): Promise<GasSponsorshipCheck> {
    console.log(`🔍 Checking gas sponsorship for ${formatEther(estimatedGas)} ETH`);
    
    // Check if paymaster is available on this chain
    const config = this.getPaymasterConfig(chainId);
    if (!config) {
      return {
        canSponsor: false,
        reason: 'Gas sponsorship only available on Lisk network',
      };
    }
    
    try {
      // Get current allowance
      const allowance = await this.getRemainingDailyGas(userAddress, chainId);
      
      // Check if paymaster is active
      if (!allowance.paymasterActive) {
        return {
          canSponsor: false,
          reason: 'Gas sponsorship temporarily unavailable',
          remainingGas: allowance.remaining,
        };
      }
      
      // Check if user has sufficient remaining gas
      if (allowance.remaining < estimatedGas) {
        return {
          canSponsor: false,
          reason: `Daily gas limit exceeded. ${formatEther(allowance.remaining)} ETH remaining, need ${formatEther(estimatedGas)} ETH`,
          remainingGas: allowance.remaining,
          estimatedGas,
        };
      }
      
      // Check if paymaster has sufficient deposit
      if (allowance.paymasterBalance < estimatedGas) {
        return {
          canSponsor: false,
          reason: 'Paymaster balance insufficient (contact support)',
          remainingGas: allowance.remaining,
        };
      }
      
      // All checks passed
      return {
        canSponsor: true,
        remainingGas: allowance.remaining,
        estimatedGas,
      };
    } catch (error: any) {
      console.error('❌ Gas sponsorship check failed:', error);
      return {
        canSponsor: false,
        reason: `Failed to check sponsorship: ${error.message}`,
      };
    }
  }
  
  /**
   * Build UserOperation with paymaster data
   * 
   * Modifies the UserOperation to include paymaster address and data if eligible.
   * Falls back to user-paid gas if not eligible.
   * 
   * @param userOp - Original UserOperation
   * @param userAddress - User's smart account address
   * @param chainId - Chain ID
   * @returns Modified UserOperation with paymaster data (or original if not eligible)
   */
  async buildPaymasterUserOp(
    userOp: Partial<UserOperation>,
    userAddress: string,
    chainId: number
  ): Promise<Partial<UserOperation>> {
    console.log('🔧 Building UserOperation with paymaster...');
    
    // Get paymaster config
    const config = this.getPaymasterConfig(chainId);
    if (!config) {
      console.log('⚠️ Paymaster not available on this chain, using user-paid gas');
      return {
        ...userOp,
        paymasterAndData: '0x' as Hex,
      };
    }
    
    try {
      // Estimate total gas cost
      const estimatedGas = 
        (userOp.callGasLimit || 0n) +
        (userOp.verificationGasLimit || 0n) +
        (userOp.preVerificationGas || 0n);
      
      const maxFeePerGas = userOp.maxFeePerGas || 0n;
      const estimatedCost = estimatedGas * maxFeePerGas;
      
      console.log(`💰 Estimated gas cost: ${formatEther(estimatedCost)} ETH`);
      
      // Check if can sponsor
      const check = await this.checkGasSponsorship(userAddress, estimatedCost, chainId);
      
      if (!check.canSponsor) {
        console.log(`⚠️ Cannot sponsor: ${check.reason}`);
        return {
          ...userOp,
          paymasterAndData: '0x' as Hex,
        };
      }
      
      // Build paymaster data
      // Format: <paymaster_address> (20 bytes) + <paymaster_data> (variable length)
      // For CPPayPaymaster, no additional data needed (validation happens on-chain)
      const paymasterAndData = config.address as Hex; // Just the paymaster address
      
      console.log('✅ Gas sponsorship approved, adding paymaster data');
      
      return {
        ...userOp,
        paymasterAndData,
      };
    } catch (error: any) {
      console.error('❌ Failed to build paymaster UserOp:', error);
      console.log('⚠️ Falling back to user-paid gas');
      return {
        ...userOp,
        paymasterAndData: '0x' as Hex,
      };
    }
  }
  
  /**
   * Get gas allowance status for UI display
   * Convenience method that uses active network from store
   * 
   * @param userAddress - User's smart account address
   * @param chainId - Chain ID (defaults to 1135 for Lisk)
   * @returns Gas allowance status
   */
  async getGasAllowanceStatus(
    userAddress: string,
    chainId: number = 1135
  ): Promise<GasAllowanceStatus | null> {
    try {
      return await this.getRemainingDailyGas(userAddress, chainId);
    } catch (error: any) {
      console.error('❌ Failed to get gas allowance status:', error);
      return null;
    }
  }
  
  /**
   * Format gas amount for display
   */
  static formatGasAmount(wei: bigint): string {
    const eth = formatEther(wei);
    const num = parseFloat(eth);
    
    if (num >= 1) {
      return `${num.toFixed(4)} ETH`;
    } else if (num >= 0.001) {
      return `${num.toFixed(6)} ETH`;
    } else {
      return `${(num * 1e9).toFixed(2)} Gwei`;
    }
  }
  
  /**
   * Get user-friendly message for gas sponsorship status
   */
  static getStatusMessage(status: GasAllowanceStatus): string {
    if (!status.paymasterActive) {
      return '⚠️ Gas sponsorship temporarily unavailable';
    }
    
    if (status.remaining === 0n) {
      const now = Math.floor(Date.now() / 1000);
      const hoursUntilReset = Math.ceil((status.resetTime - now) / 3600);
      return `❌ Daily limit reached. Resets in ${hoursUntilReset}h`;
    }
    
    if (status.percentUsed >= 90) {
      return `⚠️ ${this.formatGasAmount(status.remaining)} remaining (${100 - status.percentUsed}% left)`;
    }
    
    if (status.percentUsed >= 50) {
      return `✅ ${this.formatGasAmount(status.remaining)} remaining`;
    }
    
    return `✅ Gas sponsored (${this.formatGasAmount(status.limit)} daily limit)`;
  }
  
  /**
   * Calculate time until reset
   */
  static getTimeUntilReset(resetTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining = resetTime - now;
    
    if (secondsRemaining <= 0) {
      return 'Resetting now...';
    }
    
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

export default PaymasterService;
