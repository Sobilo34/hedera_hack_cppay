"""
PaymasterService - Gas Sponsorship Management

Integrates with CPPayPaymaster smart contract to:
- Check user's daily gas allowance
- Generate paymaster data for UserOperations
- Track gas usage and sponsorship
- Monitor paymaster balance
- Handle KYC tier multipliers
"""
import os
import logging
from decimal import Decimal
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import json

from web3 import Web3
from eth_utils import to_checksum_address
from django.core.cache import cache
from django.utils import timezone

from .web3_service import Web3Service
from apps.gas_sponsorship.models import GasSponsorship
from apps.users.models import User


logger = logging.getLogger(__name__)


# CPPayPaymaster Contract ABI - Updated to match actual contract
PAYMASTER_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "getGasStatus",
        "outputs": [
            {"internalType": "uint256", "name": "dailyLimitWei", "type": "uint256"},
            {"internalType": "uint256", "name": "usedWei", "type": "uint256"},
            {"internalType": "uint256", "name": "remainingWei", "type": "uint256"},
            {"internalType": "uint64", "name": "lastReset", "type": "uint64"},
            {"internalType": "bool", "name": "isTier2", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "baseDailyBudgetKobo",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "weiPerKobo",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "tier2Multiplier",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "paymasterActive",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "paymasterDeposit",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}, {"internalType": "bool", "name": "isTier2", "type": "bool"}],
        "name": "setUserTier",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]


# EntryPoint ABI (for balance check)
ENTRYPOINT_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]


class PaymasterService:
    """
    Gas sponsorship service using CPPayPaymaster contract
    """
    
    # Paymaster contract addresses per chain
    PAYMASTER_ADDRESSES = {
        1: os.getenv('PAYMASTER_ETHEREUM'),
        8453: os.getenv('PAYMASTER_BASE'),
        42161: os.getenv('PAYMASTER_ARBITRUM'),
        10: os.getenv('PAYMASTER_OPTIMISM'),
        137: os.getenv('PAYMASTER_POLYGON'),
        1135: os.getenv('PAYMASTER_LISK', '0x2b9a465680814037c6ab39C0CD4E62bA6e3f3FcE'),  # Lisk Mainnet
        4202: os.getenv('PAYMASTER_LISK_SEPOLIA', '0x9748fE3c0Bf3626e5453aE698B87876AC37FF1d9'),
    }
    
    # EntryPoint v0.6 address (standard across chains)
    ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
    
    # Gas limit thresholds
    LOW_BALANCE_THRESHOLD = Web3.to_wei(5, 'ether')  # Alert if paymaster balance < 5 ETH
    
    def __init__(self, chain_id: int):
        """
        Initialize Paymaster service for specific chain
        
        Args:
            chain_id: EVM chain ID
        """
        self.chain_id = chain_id
        self.web3_service = Web3Service(chain_id)
        self.w3 = self.web3_service.w3
        
        paymaster_address = self.PAYMASTER_ADDRESSES.get(chain_id)
        if not paymaster_address:
            raise ValueError(f"Paymaster not deployed on chain {chain_id}")
        
        self.paymaster_address = to_checksum_address(paymaster_address)
        self.paymaster_contract = self.w3.eth.contract(
            address=self.paymaster_address,
            abi=PAYMASTER_ABI
        )
        
        self.entrypoint_contract = self.w3.eth.contract(
            address=self.ENTRYPOINT_ADDRESS,
            abi=ENTRYPOINT_ABI
        )
        
        logger.info(f"✅ PaymasterService initialized for chain {chain_id}")
    
    def get_remaining_gas(self, user_address: str) -> Dict:
        """
        Get user's remaining daily gas allowance using getGasStatus
        
        Args:
            user_address: User's wallet address
            
        Returns:
            Dict with remaining, limit, used, reset_time, is_tier2
        """
        cache_key = f'gas_remaining:{self.chain_id}:{user_address}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            checksum_address = to_checksum_address(user_address)
            
            # Call getGasStatus which returns:
            # (dailyLimitWei, usedWei, remainingWei, lastReset, isTier2)
            daily_limit, used_wei, remaining_wei, last_reset, is_tier2 = \
                self.paymaster_contract.functions.getGasStatus(checksum_address).call()
            
            # Convert lastReset from timestamp to datetime
            reset_time = datetime.fromtimestamp(last_reset) + timedelta(days=1)
            
            result = {
                'remaining': remaining_wei,
                'limit': daily_limit,
                'used': used_wei,
                'reset_time': reset_time.isoformat(),
                'is_verified': is_tier2,  # Map isTier2 to is_verified for compatibility
                'chain_id': self.chain_id
            }
            
            # Cache for 30 seconds
            cache.set(cache_key, result, 30)
            
            logger.debug(f"💰 Gas remaining for {user_address}: {self.w3.from_wei(remaining_wei, 'ether')} ETH")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error fetching remaining gas: {str(e)}")
            raise
    
    def can_sponsor_gas(self, user_address: str, estimated_gas_cost: int) -> Tuple[bool, str]:
        """
        Check if paymaster can sponsor gas for this transaction
        
        Args:
            user_address: User's wallet address
            estimated_gas_cost: Estimated gas cost in wei
            
        Returns:
            Tuple of (can_sponsor: bool, reason: str)
        """
        try:
            # Check if paymaster is active
            is_active = self.paymaster_contract.functions.paymasterActive().call()
            if not is_active:
                return False, "Paymaster is currently inactive"
            
            # Check remaining allowance
            gas_data = self.get_remaining_gas(user_address)
            remaining = gas_data['remaining']
            
            if remaining < estimated_gas_cost:
                return False, f"Daily limit exceeded. Remaining: {self.w3.from_wei(remaining, 'ether')} ETH"
            
            # Check paymaster balance
            paymaster_balance = self.get_paymaster_balance()
            if paymaster_balance < estimated_gas_cost:
                logger.error(f"⚠️ Low paymaster balance: {self.w3.from_wei(paymaster_balance, 'ether')} ETH")
                return False, "Paymaster balance too low"
            
            return True, "Eligible for gas sponsorship"
            
        except Exception as e:
            logger.error(f"❌ Error checking gas sponsorship: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def generate_paymaster_data(self, user_address: str, estimated_gas_cost: int) -> Optional[str]:
        """
        Generate paymaster data for UserOperation
        
        Args:
            user_address: User's wallet address
            estimated_gas_cost: Estimated gas cost in wei
            
        Returns:
            Paymaster data hex string or None if cannot sponsor
        """
        can_sponsor, reason = self.can_sponsor_gas(user_address, estimated_gas_cost)
        
        if not can_sponsor:
            logger.info(f"❌ Cannot sponsor gas: {reason}")
            return None
        
        # Paymaster data format: paymasterAddress + paymasterData
        # For CPPayPaymaster, we just need the address (no additional data)
        paymaster_data = self.paymaster_address.lower()
        
        logger.info(f"✅ Generated paymaster data for {user_address}")
        return paymaster_data
    
    def update_gas_usage(self, user_address: str, gas_used: int, tx_hash: str) -> None:
        """
        Update gas usage in database for analytics
        
        Args:
            user_address: User's wallet address
            gas_used: Gas used in wei
            tx_hash: Transaction hash
        """
        try:
            # Get or create gas sponsorship record
            from apps.wallets.models import Wallet
            
            wallet = Wallet.objects.filter(
                smart_account_address=user_address,
                chain_id=self.chain_id
            ).first()
            
            if not wallet:
                logger.warning(f"⚠️ Wallet not found for address {user_address}")
                return
            
            gas_record, created = GasSponsorship.objects.get_or_create(
                user=wallet.user,
                wallet=wallet,
                chain_id=self.chain_id,
                defaults={
                    'daily_limit': self.w3.to_wei(1, 'ether'),  # 1 ETH default
                    'used_today': 0,
                    'last_reset_date': timezone.now().date()
                }
            )
            
            # Reset if new day
            if gas_record.last_reset_date < timezone.now().date():
                gas_record.used_today = 0
                gas_record.last_reset_date = timezone.now().date()
            
            # Update usage
            gas_record.used_today += gas_used
            gas_record.total_gas_sponsored += gas_used
            gas_record.transaction_count += 1
            gas_record.save()
            
            logger.info(f"✅ Updated gas usage for {user_address}: +{self.w3.from_wei(gas_used, 'ether')} ETH")
            
        except Exception as e:
            logger.error(f"❌ Error updating gas usage: {str(e)}")
    
    def reset_daily_limit_if_needed(self, user_address: str) -> None:
        """
        Reset daily limit if 24 hours have passed
        
        Args:
            user_address: User's wallet address
        """
        try:
            from apps.wallets.models import Wallet
            
            wallet = Wallet.objects.filter(
                smart_account_address=user_address,
                chain_id=self.chain_id
            ).first()
            
            if not wallet:
                return
            
            gas_record = GasSponsorship.objects.filter(
                user=wallet.user,
                wallet=wallet,
                chain_id=self.chain_id
            ).first()
            
            if not gas_record:
                return
            
            # Check if reset needed
            today = timezone.now().date()
            if gas_record.last_reset_date < today:
                gas_record.used_today = 0
                gas_record.last_reset_date = today
                gas_record.save()
                
                logger.info(f"✅ Reset daily gas limit for {user_address}")
                
        except Exception as e:
            logger.error(f"❌ Error resetting daily limit: {str(e)}")
    
    def verify_user_for_multiplier(self, user_address: str, kyc_tier: int) -> bool:
        """
        Verify user in paymaster contract to grant multiplier
        
        Args:
            user_address: User's wallet address
            kyc_tier: User's KYC tier (must be >= 2 for multiplier)
            
        Returns:
            True if verification successful
        """
        if kyc_tier < 2:
            logger.info(f"ℹ️ User {user_address} not eligible for multiplier (tier {kyc_tier})")
            return False
        
        try:
            # TODO: This requires admin wallet to send transaction
            # For now, just update in database
            from apps.wallets.models import Wallet
            
            wallet = Wallet.objects.filter(
                smart_account_address=user_address,
                chain_id=self.chain_id
            ).first()
            
            if wallet:
                gas_record = GasSponsorship.objects.filter(
                    user=wallet.user,
                    wallet=wallet,
                    chain_id=self.chain_id
                ).first()
                
                if gas_record:
                    gas_record.multiplier = 2 if kyc_tier >= 2 else 1
                    gas_record.is_verified = True
                    gas_record.save()
                    
                    logger.info(f"✅ Verified user {user_address} for {gas_record.multiplier}x multiplier")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Error verifying user: {str(e)}")
            return False
    
    def get_paymaster_balance(self) -> int:
        """
        Get paymaster's balance in EntryPoint
        
        Returns:
            Balance in wei
        """
        cache_key = f'paymaster_balance:{self.chain_id}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            balance = self.entrypoint_contract.functions.balanceOf(self.paymaster_address).call()
            
            # Cache for 5 minutes
            cache.set(cache_key, balance, 300)
            
            balance_eth = self.w3.from_wei(balance, 'ether')
            logger.debug(f"💰 Paymaster balance: {balance_eth} ETH")
            
            # Alert if low
            if balance < self.LOW_BALANCE_THRESHOLD:
                logger.warning(f"⚠️ LOW PAYMASTER BALANCE: {balance_eth} ETH on chain {self.chain_id}")
            
            return balance
            
        except Exception as e:
            logger.error(f"❌ Error fetching paymaster balance: {str(e)}")
            return 0
    
    def get_gas_statistics(self, user_address: str) -> Dict:
        """
        Get gas sponsorship statistics for user
        
        Args:
            user_address: User's wallet address
            
        Returns:
            Dictionary with gas statistics
        """
        try:
            from apps.wallets.models import Wallet
            from django.db.models import Sum
            
            wallet = Wallet.objects.filter(
                smart_account_address=user_address,
                chain_id=self.chain_id
            ).first()
            
            if not wallet:
                return {
                    'total_sponsored': 0,
                    'transaction_count': 0,
                    'average_per_tx': 0,
                    'monthly_sponsored': 0
                }
            
            gas_record = GasSponsorship.objects.filter(
                user=wallet.user,
                wallet=wallet,
                chain_id=self.chain_id
            ).first()
            
            if not gas_record:
                return {
                    'total_sponsored': 0,
                    'transaction_count': 0,
                    'average_per_tx': 0,
                    'monthly_sponsored': 0
                }
            
            # Calculate statistics
            total_sponsored = gas_record.total_gas_sponsored
            tx_count = gas_record.transaction_count
            avg_per_tx = total_sponsored / tx_count if tx_count > 0 else 0
            
            # Get monthly total
            from datetime import datetime
            from django.utils import timezone
            
            start_of_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            monthly_records = GasSponsorship.objects.filter(
                user=wallet.user,
                chain_id=self.chain_id,
                updated_at__gte=start_of_month
            ).aggregate(total=Sum('used_today'))
            
            monthly_sponsored = monthly_records.get('total', 0) or 0
            
            return {
                'total_sponsored': total_sponsored,
                'transaction_count': tx_count,
                'average_per_tx': avg_per_tx,
                'monthly_sponsored': monthly_sponsored,
                'chain_id': self.chain_id,
                'total_sponsored_eth': float(self.w3.from_wei(total_sponsored, 'ether')),
                'monthly_sponsored_eth': float(self.w3.from_wei(monthly_sponsored, 'ether')),
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting gas statistics: {str(e)}")
            return {}
    
    def monitor_and_alert(self) -> Dict:
        """
        Monitor paymaster status and return alerts
        
        Returns:
            Dictionary with monitoring data and alerts
        """
        alerts = []
        
        try:
            # Check paymaster balance
            balance = self.get_paymaster_balance()
            balance_eth = float(self.w3.from_wei(balance, 'ether'))
            
            if balance < self.LOW_BALANCE_THRESHOLD:
                alerts.append({
                    'level': 'critical',
                    'message': f'Low paymaster balance: {balance_eth:.4f} ETH on chain {self.chain_id}',
                    'action': 'Fund paymaster immediately'
                })
            elif balance < self.w3.to_wei(10, 'ether'):
                alerts.append({
                    'level': 'warning',
                    'message': f'Paymaster balance getting low: {balance_eth:.4f} ETH on chain {self.chain_id}',
                    'action': 'Consider funding soon'
                })
            
            # Check if paymaster is active
            is_active = self.paymaster_contract.functions.paymasterActive().call()
            if not is_active:
                alerts.append({
                    'level': 'critical',
                    'message': f'Paymaster is INACTIVE on chain {self.chain_id}',
                    'action': 'Activate paymaster contract'
                })
            
            return {
                'chain_id': self.chain_id,
                'balance': balance,
                'balance_eth': balance_eth,
                'is_active': is_active,
                'alerts': alerts,
                'timestamp': timezone.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error monitoring paymaster: {str(e)}")
            return {
                'chain_id': self.chain_id,
                'error': str(e),
                'alerts': [{
                    'level': 'error',
                    'message': f'Failed to monitor paymaster: {str(e)}'
                }]
            }
