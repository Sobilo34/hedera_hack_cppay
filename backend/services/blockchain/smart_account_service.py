"""
SmartAccountService - ERC-4337 Smart Account Management

Handles:
- Smart account deployment
- Smart account address prediction
- Session key management
- Batch transaction support
"""
import os
import logging
from typing import Dict, Optional
from web3 import Web3
from eth_utils import to_checksum_address
from eth_account import Account

from .web3_service import Web3Service


logger = logging.getLogger(__name__)


class SmartAccountService:
    """
    Service for ERC-4337 Smart Account operations
    """
    
    # SimpleAccountFactory addresses (EntryPoint v0.6)
    FACTORY_ADDRESSES = {
        1: '0x9406Cc6185a346906296840746125a0E44976454',
        8453: '0x9406Cc6185a346906296840746125a0E44976454',
        42161: '0x9406Cc6185a346906296840746125a0E44976454',
        10: '0x9406Cc6185a346906296840746125a0E44976454',
        137: '0x9406Cc6185a346906296840746125a0E44976454',
        1135: os.getenv('FACTORY_LISK', '0x9406Cc6185a346906296840746125a0E44976454'),
        4202: os.getenv('FACTORY_LISK_SEPOLIA', '0x9406Cc6185a346906296840746125a0E44976454'),
    }
    
    def __init__(self, chain_id: int):
        """
        Initialize Smart Account Service
        
        Args:
            chain_id: EVM chain ID
        """
        self.chain_id = chain_id
        self.web3_service = Web3Service(chain_id)
        self.w3 = self.web3_service.w3
        
        factory_address = self.FACTORY_ADDRESSES.get(chain_id)
        if not factory_address:
            raise ValueError(f"Smart Account Factory not available on chain {chain_id}")
        
        self.factory_address = to_checksum_address(factory_address)
        
        logger.info(f"✅ SmartAccountService initialized for chain {chain_id}")
    
    def predict_smart_account_address(self, eoa_address: str, salt: int = 0) -> str:
        """
        Predict smart account address before deployment
        
        Args:
            eoa_address: EOA address that will be the owner
            salt: Salt for CREATE2 (default 0)
            
        Returns:
            Predicted smart account address
        """
        try:
            # This is a simplified prediction
            # In production, use the actual factory's getAddress() function
            
            # For SimpleAccount:
            # initCode = factoryAddress + createAccount(owner, salt)
            
            owner = to_checksum_address(eoa_address)
            
            # Create initCode hash for CREATE2
            # address = keccak256(0xff + factory + salt + keccak256(initCode))[12:]
            
            # Simplified: just return a deterministic address
            # TODO: Implement actual CREATE2 prediction
            
            init_code_hash = Web3.keccak(
                hexstr=f"0x{owner[2:].zfill(64)}{hex(salt)[2:].zfill(64)}"
            )
            
            # CREATE2 address calculation
            create2_input = b'\xff' + bytes.fromhex(self.factory_address[2:]) + \
                           salt.to_bytes(32, 'big') + init_code_hash
            
            address_bytes = Web3.keccak(create2_input)[12:]
            predicted_address = '0x' + address_bytes.hex()
            
            logger.info(f"📍 Predicted smart account: {predicted_address} for owner {eoa_address}")
            return to_checksum_address(predicted_address)
            
        except Exception as e:
            logger.error(f"❌ Error predicting smart account address: {str(e)}")
            raise
    
    def is_smart_account_deployed(self, smart_account_address: str) -> bool:
        """
        Check if smart account is deployed
        
        Args:
            smart_account_address: Smart account address
            
        Returns:
            True if deployed
        """
        return self.web3_service.contract_exists(smart_account_address)
    
    def get_smart_account_init_code(self, eoa_address: str, salt: int = 0) -> str:
        """
        Generate initCode for deploying smart account
        
        Args:
            eoa_address: EOA address that will be the owner
            salt: Salt for CREATE2
            
        Returns:
            initCode hex string
        """
        try:
            owner = to_checksum_address(eoa_address)
            
            # SimpleAccountFactory.createAccount(owner, salt)
            # Function selector: 0x5fbfb9cf
            create_account_selector = '0x5fbfb9cf'
            
            # Encode parameters
            encoded_owner = owner[2:].zfill(64)
            encoded_salt = hex(salt)[2:].zfill(64)
            
            # initCode = factoryAddress + createAccount(owner, salt)
            init_code = self.factory_address.lower() + \
                       create_account_selector[2:] + \
                       encoded_owner + \
                       encoded_salt
            
            logger.info(f"📝 Generated initCode for {eoa_address}")
            return init_code
            
        except Exception as e:
            logger.error(f"❌ Error generating initCode: {str(e)}")
            raise
    
    def estimate_deployment_gas(self, eoa_address: str) -> int:
        """
        Estimate gas for smart account deployment
        
        Args:
            eoa_address: EOA address
            
        Returns:
            Estimated gas
        """
        # Smart account deployment typically costs ~200k-300k gas
        # This includes factory call + account creation + initialization
        return 250000
    
    def get_smart_account_info(self, smart_account_address: str) -> Dict:
        """
        Get smart account information
        
        Args:
            smart_account_address: Smart account address
            
        Returns:
            Dictionary with account info
        """
        try:
            is_deployed = self.is_smart_account_deployed(smart_account_address)
            
            if not is_deployed:
                return {
                    'address': smart_account_address,
                    'deployed': False,
                    'chain_id': self.chain_id
                }
            
            # Get balance
            balance = self.web3_service.get_native_balance(smart_account_address)
            
            # Get nonce (would need to call smart account's getNonce())
            # Placeholder for now
            nonce = 0
            
            return {
                'address': smart_account_address,
                'deployed': True,
                'balance': float(balance),
                'nonce': nonce,
                'chain_id': self.chain_id
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting smart account info: {str(e)}")
            raise
    
    def create_session_key(
        self,
        smart_account_address: str,
        session_key_address: str,
        valid_until: int,
        valid_after: int = 0
    ) -> Dict:
        """
        Create session key data for smart account
        
        Args:
            smart_account_address: Smart account address
            session_key_address: Session key address
            valid_until: Unix timestamp when session expires
            valid_after: Unix timestamp when session becomes valid
            
        Returns:
            Session key data
        """
        try:
            return {
                'smart_account': smart_account_address,
                'session_key': session_key_address,
                'valid_until': valid_until,
                'valid_after': valid_after,
                'is_active': True
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating session key: {str(e)}")
            raise
    
    @staticmethod
    def generate_session_key() -> Dict:
        """
        Generate a new session key pair
        
        Returns:
            Dict with private_key and address
        """
        account = Account.create()
        return {
            'private_key': account.key.hex(),
            'address': account.address
        }
