"""Blockchain Services - Web3 integration for CPPay."""

from importlib import import_module
from typing import Any

from .bridge_event_service import (
    BridgeEventMetadata,
    decode_metadata as decode_bridge_metadata,
    hash_metadata_from_hex,
)

__all__ = [
    "Web3Service",
    "PaymasterService",
    "PaymasterControllerService",
    "TransactionService",
    "SmartAccountService",
    "BridgeEventMetadata",
    "decode_bridge_metadata",
    "hash_metadata_from_hex",
    "load_contract_interface",
    "clear_cache",
    "MissingABIError",
]


_LAZY_IMPORTS = {
    "Web3Service": ("services.blockchain.web3_service", "Web3Service"),
    "PaymasterService": ("services.blockchain.paymaster_service", "PaymasterService"),
    "PaymasterControllerService": ("services.blockchain.paymaster_controller", "PaymasterControllerService"),
    "TransactionService": ("services.blockchain.transaction_service", "TransactionService"),
    "SmartAccountService": ("services.blockchain.smart_account_service", "SmartAccountService"),
    "load_contract_interface": ("services.blockchain.abi_loader", "load_contract_interface"),
    "clear_cache": ("services.blockchain.abi_loader", "clear_cache"),
    "MissingABIError": ("services.blockchain.abi_loader", "MissingABIError"),
}


def __getattr__(name: str) -> Any:  # pragma: no cover - import bridge
    if name in _LAZY_IMPORTS:
        module_name, attr_name = _LAZY_IMPORTS[name]
        module = import_module(module_name)
        value = getattr(module, attr_name)
        globals()[name] = value
        return value
    raise AttributeError(f"module 'services.blockchain' has no attribute '{name}'")
