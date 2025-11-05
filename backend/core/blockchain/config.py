"""
Blockchain Configuration
Network and contract settings for CPPay smart contracts
"""

from typing import Dict, Any
from pydantic import BaseModel, Field


class NetworkConfig(BaseModel):
    """Network configuration for a blockchain"""
    name: str
    chain_id: int
    rpc_url: str
    explorer_url: str
    currency_symbol: str


class ContractConfig(BaseModel):
    """Smart contract configuration"""
    address: str
    abi_path: str
    

# Lisk Sepolia (Testnet) Configuration
LISK_SEPOLIA = NetworkConfig(
    name="Lisk Sepolia",
    chain_id=4202,
    rpc_url="https://rpc.sepolia-api.lisk.com",
    explorer_url="https://sepolia-blockscout.lisk.com",
    currency_symbol="ETH"
)

# Lisk Mainnet Configuration (for future)
LISK_MAINNET = NetworkConfig(
    name="Lisk",
    chain_id=1135,
    rpc_url="https://rpc.api.lisk.com",
    explorer_url="https://blockscout.lisk.com",
    currency_symbol="ETH"
)

# ERC-4337 EntryPoint v0.6 (same across all chains)
ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

# CPPayPaymaster Contract (deployed on Lisk Sepolia)
CPPAY_PAYMASTER_ADDRESS = "0x0000000000000000000000000000000000000000"  # TODO: Replace with actual deployed address

# SessionKeyModule Contract (deployed on Lisk Sepolia)
SESSION_KEY_MODULE_ADDRESS = "0x0000000000000000000000000000000000000000"  # TODO: Replace with actual deployed address

# Paymaster ABI - functions we need to interact with
PAYMASTER_ABI = [
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "getRemainingDailyGas",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "", "type": "address"}],
        "name": "userGasData",
        "outputs": [
            {"name": "gasUsedToday", "type": "uint256"},
            {"name": "lastResetTime", "type": "uint256"},
            {"name": "isVerified", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "DAILY_GAS_LIMIT",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "verifiedUserMultiplier",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "verifyUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Session Key Module ABI - functions we need
SESSION_KEY_MODULE_ABI = [
    {
        "inputs": [
            {"name": "sessionPublicKey", "type": "address"},
            {"name": "validUntil", "type": "uint48"},
            {"name": "validAfter", "type": "uint48"},
            {"name": "permissions", "type": "bytes"}
        ],
        "name": "createSessionKey",
        "outputs": [{"name": "sessionKeyId", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "account", "type": "address"},
            {"name": "sessionKeyId", "type": "bytes32"},
            {"name": "userOpHash", "type": "bytes32"},
            {"name": "signature", "type": "bytes"}
        ],
        "name": "validateSessionKey",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "sessionKeyId", "type": "bytes32"}],
        "name": "revokeSessionKey",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "account", "type": "address"},
            {"name": "sessionKeyId", "type": "bytes32"}
        ],
        "name": "isSessionKeyValid",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Network settings by chain ID
NETWORKS: Dict[int, NetworkConfig] = {
    4202: LISK_SEPOLIA,  # Testnet
    1135: LISK_MAINNET,  # Mainnet (future)
}

# Default network for development
DEFAULT_NETWORK = LISK_SEPOLIA
DEFAULT_CHAIN_ID = 4202


def get_network(chain_id: int) -> NetworkConfig:
    """Get network configuration by chain ID"""
    if chain_id not in NETWORKS:
        raise ValueError(f"Unsupported chain ID: {chain_id}")
    return NETWORKS[chain_id]


def get_paymaster_address(chain_id: int) -> str:
    """Get CPPayPaymaster address for chain"""
    # For now, only Lisk Sepolia is supported
    if chain_id == 4202:
        return CPPAY_PAYMASTER_ADDRESS
    raise ValueError(f"Paymaster not deployed on chain {chain_id}")


def get_session_module_address(chain_id: int) -> str:
    """Get SessionKeyModule address for chain"""
    # For now, only Lisk Sepolia is supported
    if chain_id == 4202:
        return SESSION_KEY_MODULE_ADDRESS
    raise ValueError(f"SessionKeyModule not deployed on chain {chain_id}")
