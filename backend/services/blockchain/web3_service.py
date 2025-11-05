"""
Web3Service - Multi-chain blockchain interaction service

Handles:
- Multi-chain support (Ethereum, Base, Arbitrum, Optimism, Polygon, Lisk)
- Connection pooling and failover
- Native and ERC-20 token balance queries
- Transaction signing and broadcasting
- Gas estimation
- Transaction monitoring
"""
import os
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from functools import lru_cache
import asyncio

from web3 import Web3
try:
    from web3.middleware import ExtraDataToPOAMiddleware
    geth_poa_middleware = ExtraDataToPOAMiddleware
except ImportError:
    # Fallback for older web3.py versions
    from web3.middleware import geth_poa_middleware
from eth_account import Account
from eth_utils import is_address, to_checksum_address
import httpx


logger = logging.getLogger(__name__)


# ERC-20 Token ABI (minimal)
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]


class Web3Service:
    """
    Multi-chain Web3 service with automatic failover and caching
    """
    
    # Network configurations
    NETWORKS = {
        1: {  # Ethereum Mainnet
            'name': 'Ethereum',
            'rpc_urls': [
                os.getenv('ETHEREUM_RPC_URL', 'https://eth.llamarpc.com'),
                'https://ethereum.publicnode.com',
                'https://rpc.ankr.com/eth'
            ],
            'explorer': 'https://etherscan.io',
            'native_token': 'ETH',
            'chain_id': 1,
        },
        8453: {  # Base
            'name': 'Base',
            'rpc_urls': [
                os.getenv('BASE_RPC_URL', 'https://mainnet.base.org'),
                'https://base.llamarpc.com',
                'https://base.publicnode.com'
            ],
            'explorer': 'https://basescan.org',
            'native_token': 'ETH',
            'chain_id': 8453,
        },
        42161: {  # Arbitrum One
            'name': 'Arbitrum',
            'rpc_urls': [
                os.getenv('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc'),
                'https://arbitrum.llamarpc.com',
                'https://arbitrum-one.publicnode.com'
            ],
            'explorer': 'https://arbiscan.io',
            'native_token': 'ETH',
            'chain_id': 42161,
        },
        10: {  # Optimism
            'name': 'Optimism',
            'rpc_urls': [
                os.getenv('OPTIMISM_RPC_URL', 'https://mainnet.optimism.io'),
                'https://optimism.llamarpc.com',
                'https://optimism.publicnode.com'
            ],
            'explorer': 'https://optimistic.etherscan.io',
            'native_token': 'ETH',
            'chain_id': 10,
        },
        137: {  # Polygon
            'name': 'Polygon',
            'rpc_urls': [
                os.getenv('POLYGON_RPC_URL', 'https://polygon-rpc.com'),
                'https://polygon.llamarpc.com',
                'https://polygon-bor.publicnode.com'
            ],
            'explorer': 'https://polygonscan.com',
            'native_token': 'MATIC',
            'chain_id': 137,
        },
        1135: {  # Lisk Mainnet
            'name': 'Lisk',
            'rpc_urls': [
                os.getenv('LISK_RPC_URL', 'https://rpc.api.lisk.com'),
            ],
            'explorer': 'https://blockscout.lisk.com',
            'native_token': 'ETH',
            'chain_id': 1135,
        },
        4202: {  # Lisk Sepolia Testnet
            'name': 'Lisk Sepolia',
            'rpc_urls': [
                os.getenv('LISK_SEPOLIA_RPC_URL', 'https://rpc.sepolia-api.lisk.com'),
            ],
            'explorer': 'https://sepolia-blockscout.lisk.com',
            'native_token': 'ETH',
            'chain_id': 4202,
        },
        10143: {  # Monad Mainnet
            'name': 'Monad',
            'rpc_urls': [
                os.getenv('MONAD_RPC_URL', 'https://mainnet.monad.xyz/rpc'),
                'https://monad-mainnet.g.alchemy.com/v2/your-api-key',
            ],
            'explorer': 'https://monadexplorer.com',
            'native_token': 'MON',
            'chain_id': 10143,
        },
        50: {  # Somnia Mainnet
            'name': 'Somnia',
            'rpc_urls': [
                os.getenv('SOMNIA_RPC_URL', 'https://rpc-mainnet.somnia.network'),
                'https://somnia.g.alchemy.com/v2/your-api-key',
            ],
            'explorer': 'https://explorer.somnia.network',
            'native_token': 'SOMA',
            'chain_id': 50,
        },
        295: {  # Hedera Mainnet
            'name': 'Hedera',
            'rpc_urls': [
                os.getenv('HEDERA_RPC_URL', 'https://mainnet.hashio.io/api'),
                'https://hedera-mainnet.g.alchemy.com/v2/your-api-key',
            ],
            'explorer': 'https://hashscan.io',
            'native_token': 'HBAR',
            'chain_id': 295,
        },
    }
    
    # Token contract addresses
    TOKEN_CONTRACTS = {
        'USDC': {
            1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            10143: '0x0000000000000000000000000000000000000000',  # Monad - TBD
            50: '0x0000000000000000000000000000000000000000',  # Somnia - TBD
            295: '0x0000000000000000000000000000000000000000',  # Hedera - TBD
        },
        'USDT': {
            1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            10143: '0x0000000000000000000000000000000000000000',  # Monad - TBD
            50: '0x0000000000000000000000000000000000000000',  # Somnia - TBD
            295: '0x0000000000000000000000000000000000000000',  # Hedera - TBD
        },
        'DAI': {
            1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
            42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            10143: '0x0000000000000000000000000000000000000000',  # Monad - TBD
            50: '0x0000000000000000000000000000000000000000',  # Somnia - TBD
            295: '0x0000000000000000000000000000000000000000',  # Hedera - TBD
        },
        'CNGN': {
            1: '0x0996d4aaf9c4b669be0f6edca9d0ac086b1c5ef6',
            8453: '0xAEbe5bBb32c7634c1a47D11a6b7c68f25d07d8F5',
        },
        'MON': {
            10143: '0x0000000000000000000000000000000000000000',  # Monad native token
        },
        'SOMA': {
            50: '0x0000000000000000000000000000000000000000',  # Somnia native token
        },
        'HBAR': {
            295: '0x0000000000000000000000000000000000000000',  # Hedera native token
        },
    }
    
    def __init__(self, chain_id: int, max_retries: int = 3):
        """
        Initialize Web3 service for a specific chain
        
        Args:
            chain_id: EVM chain ID
            max_retries: Maximum retry attempts for RPC calls
        """
        if chain_id not in self.NETWORKS:
            raise ValueError(f"Unsupported chain ID: {chain_id}")
        
        self.chain_id = chain_id
        self.network = self.NETWORKS[chain_id]
        self.max_retries = max_retries
        self.w3 = self._create_web3_instance()
        
        logger.info(f"✅ Web3Service initialized for {self.network['name']} (Chain ID: {chain_id})")
    
    def _create_web3_instance(self) -> Web3:
        """Create Web3 instance with automatic provider failover"""
        for rpc_url in self.network['rpc_urls']:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 30}))
                
                # Add PoA middleware for certain chains
                if self.chain_id in [137, 56]:  # Polygon, BSC
                    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
                
                # Test connection
                if w3.is_connected():
                    chain_id = w3.eth.chain_id
                    if chain_id == self.chain_id:
                        logger.info(f"✅ Connected to {self.network['name']} via {rpc_url}")
                        return w3
                    else:
                        logger.warning(f"⚠️ Chain ID mismatch. Expected {self.chain_id}, got {chain_id}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to connect to {rpc_url}: {str(e)}")
                continue
        
        raise ConnectionError(f"❌ Failed to connect to any RPC endpoint for chain {self.chain_id}")
    
    def validate_address(self, address: str) -> bool:
        """
        Validate Ethereum address format
        
        Args:
            address: Ethereum address to validate
            
        Returns:
            True if valid address
        """
        return is_address(address)
    
    def get_native_balance(self, address: str) -> Decimal:
        """
        Get native token balance (ETH, MATIC, etc.)
        
        Args:
            address: Wallet address
            
        Returns:
            Balance in native token (e.g., 1.5 ETH)
        """
        if not self.validate_address(address):
            raise ValueError(f"Invalid address: {address}")
        
        try:
            checksum_address = to_checksum_address(address)
            balance_wei = self.w3.eth.get_balance(checksum_address)
            balance_ether = Decimal(str(self.w3.from_wei(balance_wei, 'ether')))
            
            logger.debug(f"💰 Balance for {address}: {balance_ether} {self.network['native_token']}")
            return balance_ether
        except Exception as e:
            logger.error(f"❌ Error fetching native balance: {str(e)}")
            raise
    
    def get_token_balance(self, address: str, token_symbol: str) -> Decimal:
        """
        Get ERC-20 token balance
        
        Args:
            address: Wallet address
            token_symbol: Token symbol (e.g., 'USDC', 'USDT')
            
        Returns:
            Token balance (0 if token not deployed on this chain)
        """
        if not self.validate_address(address):
            raise ValueError(f"Invalid address: {address}")
        
        if token_symbol not in self.TOKEN_CONTRACTS:
            raise ValueError(f"Unsupported token: {token_symbol}")
        
        token_addresses = self.TOKEN_CONTRACTS[token_symbol]
        if self.chain_id not in token_addresses:
            raise ValueError(f"{token_symbol} not available on {self.network['name']}")
        
        token_address = token_addresses[self.chain_id]
        
        # Check if token address is a placeholder (zero address = not deployed)
        zero_address = '0x0000000000000000000000000000000000000000'
        if token_address.lower() == zero_address.lower():
            logger.info(f"ℹ️  {token_symbol} not yet deployed on {self.network['name']} (placeholder address)")
            return Decimal('0')
        
        try:
            checksum_address = to_checksum_address(address)
            checksum_token = to_checksum_address(token_address)
            
            # Create contract instance
            contract = self.w3.eth.contract(address=checksum_token, abi=ERC20_ABI)
            
            # Get balance and decimals
            balance_raw = contract.functions.balanceOf(checksum_address).call()
            decimals = contract.functions.decimals().call()
            
            # Convert to decimal
            balance = Decimal(str(balance_raw)) / Decimal(10 ** decimals)
            
            logger.debug(f"💰 {token_symbol} balance for {address}: {balance}")
            return balance
        except Exception as e:
            logger.error(f"❌ Error fetching {token_symbol} balance: {str(e)}")
            raise
    
    def get_token_balances(self, address: str, tokens: List[str]) -> Dict[str, Decimal]:
        """
        Get multiple token balances efficiently
        
        Args:
            address: Wallet address
            tokens: List of token symbols
            
        Returns:
            Dictionary of {token: balance}
        """
        balances = {}
        
        for token in tokens:
            try:
                balance = self.get_token_balance(address, token)
                balances[token] = balance
            except Exception as e:
                logger.error(f"❌ Failed to fetch {token} balance: {str(e)}")
                balances[token] = Decimal('0')
        
        return balances
    
    def estimate_gas(self, tx_data: dict) -> int:
        """
        Estimate gas for a transaction
        
        Args:
            tx_data: Transaction data dictionary
            
        Returns:
            Estimated gas units (with 20% buffer)
        """
        try:
            gas_estimate = self.w3.eth.estimate_gas(tx_data)
            # Add 20% buffer for safety
            gas_with_buffer = int(gas_estimate * 1.2)
            
            logger.debug(f"⛽ Gas estimate: {gas_estimate} (with buffer: {gas_with_buffer})")
            return gas_with_buffer
        except Exception as e:
            logger.error(f"❌ Gas estimation failed: {str(e)}")
            # Return default gas limit
            return 200000
    
    def get_gas_price(self) -> Dict[str, int]:
        """
        Get current gas prices (EIP-1559)
        
        Returns:
            Dictionary with base_fee, max_priority_fee, max_fee
        """
        try:
            # Get latest block for base fee
            latest_block = self.w3.eth.get_block('latest')
            base_fee = latest_block.get('baseFeePerGas', 0)
            
            # Get priority fee
            max_priority_fee = self.w3.eth.max_priority_fee
            
            # Calculate max fee (base fee + priority fee + buffer)
            max_fee = int(base_fee * 1.2) + max_priority_fee
            
            return {
                'base_fee': base_fee,
                'max_priority_fee': max_priority_fee,
                'max_fee': max_fee
            }
        except Exception as e:
            logger.error(f"❌ Error fetching gas price: {str(e)}")
            # Return fallback values
            return {
                'base_fee': self.w3.to_wei('20', 'gwei'),
                'max_priority_fee': self.w3.to_wei('2', 'gwei'),
                'max_fee': self.w3.to_wei('25', 'gwei')
            }
    
    def send_transaction(self, signed_tx: str) -> str:
        """
        Broadcast signed transaction
        
        Args:
            signed_tx: Signed transaction hex string
            
        Returns:
            Transaction hash
        """
        try:
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx)
            tx_hash_hex = tx_hash.hex()
            
            logger.info(f"✅ Transaction broadcast: {tx_hash_hex}")
            return tx_hash_hex
        except Exception as e:
            logger.error(f"❌ Transaction broadcast failed: {str(e)}")
            raise
    
    def wait_for_transaction(self, tx_hash: str, timeout: int = 300) -> dict:
        """
        Wait for transaction confirmation
        
        Args:
            tx_hash: Transaction hash
            timeout: Maximum wait time in seconds
            
        Returns:
            Transaction receipt
        """
        try:
            logger.info(f"⏳ Waiting for transaction {tx_hash}...")
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
            
            status = receipt.get('status', 0)
            if status == 1:
                logger.info(f"✅ Transaction confirmed: {tx_hash}")
            else:
                logger.error(f"❌ Transaction failed: {tx_hash}")
            
            return dict(receipt)
        except Exception as e:
            logger.error(f"❌ Error waiting for transaction: {str(e)}")
            raise
    
    def get_transaction(self, tx_hash: str) -> Optional[dict]:
        """
        Get transaction details
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            Transaction data or None
        """
        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            return dict(tx) if tx else None
        except Exception as e:
            logger.error(f"❌ Error fetching transaction: {str(e)}")
            return None
    
    def get_transaction_receipt(self, tx_hash: str) -> Optional[dict]:
        """
        Get transaction receipt
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            Transaction receipt or None
        """
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return dict(receipt) if receipt else None
        except Exception as e:
            logger.error(f"❌ Error fetching receipt: {str(e)}")
            return None
    
    def contract_exists(self, address: str) -> bool:
        """
        Check if address is a contract
        
        Args:
            address: Contract address
            
        Returns:
            True if contract exists
        """
        try:
            checksum_address = to_checksum_address(address)
            code = self.w3.eth.get_code(checksum_address)
            return len(code) > 0
        except Exception as e:
            logger.error(f"❌ Error checking contract: {str(e)}")
            return False
    
    def get_block_number(self) -> int:
        """Get latest block number"""
        return self.w3.eth.block_number
    
    def get_block(self, block_identifier: int | str) -> dict:
        """Get block details"""
        return dict(self.w3.eth.get_block(block_identifier))
    
    @classmethod
    def get_supported_networks(cls) -> List[dict]:
        """Get list of all supported networks"""
        return [
            {
                'chain_id': chain_id,
                'name': info['name'],
                'native_token': info['native_token'],
                'explorer': info['explorer']
            }
            for chain_id, info in cls.NETWORKS.items()
        ]
    
    @classmethod
    def get_token_address(cls, token_symbol: str, chain_id: int) -> Optional[str]:
        """Get token contract address for specific chain"""
        if token_symbol not in cls.TOKEN_CONTRACTS:
            return None
        return cls.TOKEN_CONTRACTS[token_symbol].get(chain_id)
