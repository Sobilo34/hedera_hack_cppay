"""
Web3 Client - Minimal wrapper for contract interactions
Simple client to interact with deployed CPPayPaymaster and SessionKeyModule
"""

from typing import Dict, Any, Tuple, Optional
from decimal import Decimal
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError
import logging

from .config import (
    get_network,
    get_paymaster_address,
    get_session_module_address,
    PAYMASTER_ABI,
    SESSION_KEY_MODULE_ABI,
    DEFAULT_CHAIN_ID
)

logger = logging.getLogger(__name__)


class Web3Client:
    """
    Minimal Web3 client for interacting with CPPay smart contracts
    Focused ONLY on reading data and calling contract functions
    """
    
    def __init__(self, chain_id: int = DEFAULT_CHAIN_ID):
        """Initialize Web3 client for specific chain"""
        self.chain_id = chain_id
        self.network = get_network(chain_id)
        
        # Initialize Web3 with RPC URL
        self.w3 = Web3(Web3.HTTPProvider(self.network.rpc_url))
        
        # Verify connection
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to {self.network.name} RPC")
        
        # Initialize contracts
        self.paymaster = self._init_paymaster_contract()
        self.session_module = self._init_session_module_contract()
        
        logger.info(f"Web3 client initialized for {self.network.name} (Chain ID: {chain_id})")
    
    def _init_paymaster_contract(self) -> Contract:
        """Initialize CPPayPaymaster contract"""
        address = get_paymaster_address(self.chain_id)
        return self.w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=PAYMASTER_ABI
        )
    
    def _init_session_module_contract(self) -> Contract:
        """Initialize SessionKeyModule contract"""
        address = get_session_module_address(self.chain_id)
        return self.w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=SESSION_KEY_MODULE_ABI
        )
    
    # ==================== PAYMASTER FUNCTIONS ====================
    
    def get_remaining_gas(self, user_address: str) -> Decimal:
        """
        Get user's remaining daily gas allowance
        Returns: Remaining gas in ETH
        """
        try:
            checksum_address = Web3.to_checksum_address(user_address)
            remaining_wei = self.paymaster.functions.getRemainingDailyGas(checksum_address).call()
            
            # Convert wei to ETH
            remaining_eth = Decimal(remaining_wei) / Decimal(10**18)
            
            logger.info(f"User {user_address} has {remaining_eth} ETH remaining")
            return remaining_eth
            
        except ContractLogicError as e:
            logger.error(f"Contract error getting remaining gas: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting remaining gas: {e}")
            raise
    
    def get_user_gas_data(self, user_address: str) -> Dict[str, Any]:
        """
        Get detailed gas data for user
        Returns: {gasUsedToday, lastResetTime, isVerified}
        """
        try:
            checksum_address = Web3.to_checksum_address(user_address)
            gas_used, last_reset, is_verified = self.paymaster.functions.userGasData(checksum_address).call()
            
            return {
                'gas_used_today': Decimal(gas_used) / Decimal(10**18),  # Convert to ETH
                'last_reset_time': last_reset,
                'is_verified': is_verified
            }
            
        except Exception as e:
            logger.error(f"Error getting user gas data: {e}")
            raise
    
    def get_daily_gas_limit(self) -> Decimal:
        """
        Get base daily gas limit from contract
        Returns: Daily limit in ETH
        """
        try:
            limit_wei = self.paymaster.functions.DAILY_GAS_LIMIT().call()
            return Decimal(limit_wei) / Decimal(10**18)
        except Exception as e:
            logger.error(f"Error getting daily gas limit: {e}")
            raise
    
    def get_verified_user_multiplier(self) -> int:
        """
        Get multiplier for verified users
        Returns: Multiplier (e.g., 2 for 2x limit)
        """
        try:
            return self.paymaster.functions.verifiedUserMultiplier().call()
        except Exception as e:
            logger.error(f"Error getting verified user multiplier: {e}")
            raise
    
    def get_gas_allowance_status(self, user_address: str) -> Dict[str, Any]:
        """
        Get comprehensive gas allowance status for user
        Returns: Complete status including remaining, limit, used, reset time
        """
        try:
            checksum_address = Web3.to_checksum_address(user_address)
            
            # Get all data in parallel
            remaining = self.get_remaining_gas(user_address)
            user_data = self.get_user_gas_data(user_address)
            base_limit = self.get_daily_gas_limit()
            multiplier = self.get_verified_user_multiplier()
            
            # Calculate user's actual limit
            if user_data['is_verified']:
                user_limit = base_limit * multiplier
            else:
                user_limit = base_limit
            
            # Calculate percentage used
            if user_limit > 0:
                percent_used = float((user_data['gas_used_today'] / user_limit) * 100)
            else:
                percent_used = 0.0
            
            return {
                'remaining': remaining,
                'limit': user_limit,
                'used': user_data['gas_used_today'],
                'reset_time': user_data['last_reset_time'],
                'is_verified': user_data['is_verified'],
                'percent_used': round(percent_used, 2),
                'can_sponsor': remaining > 0
            }
            
        except Exception as e:
            logger.error(f"Error getting gas allowance status: {e}")
            raise
    
    # ==================== SESSION KEY FUNCTIONS ====================
    
    def is_session_key_valid(self, account_address: str, session_key_id: str) -> bool:
        """
        Check if session key is valid for account
        Returns: True if valid, False otherwise
        """
        try:
            checksum_address = Web3.to_checksum_address(account_address)
            session_key_bytes = bytes.fromhex(session_key_id.replace('0x', ''))
            
            is_valid = self.session_module.functions.isSessionKeyValid(
                checksum_address,
                session_key_bytes
            ).call()
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Error checking session key validity: {e}")
            return False
    
    # ==================== UTILITY FUNCTIONS ====================
    
    def get_balance(self, address: str) -> Decimal:
        """
        Get ETH balance for address
        Returns: Balance in ETH
        """
        try:
            checksum_address = Web3.to_checksum_address(address)
            balance_wei = self.w3.eth.get_balance(checksum_address)
            return Decimal(balance_wei) / Decimal(10**18)
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            raise
    
    def is_valid_address(self, address: str) -> bool:
        """Validate Ethereum address"""
        return Web3.is_address(address)
    
    def to_checksum_address(self, address: str) -> str:
        """Convert address to checksum format"""
        return Web3.to_checksum_address(address)


# Singleton instance for easy access
_client_instance: Optional[Web3Client] = None


def get_web3_client(chain_id: int = DEFAULT_CHAIN_ID) -> Web3Client:
    """Get or create Web3 client singleton"""
    global _client_instance
    if _client_instance is None or _client_instance.chain_id != chain_id:
        _client_instance = Web3Client(chain_id)
    return _client_instance
