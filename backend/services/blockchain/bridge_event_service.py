"""Utilities for decoding and hashing NGN bridge event metadata."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any

try:  # pragma: no cover - optional dependency guard
    from web3 import Web3  # type: ignore
except ImportError:  # pragma: no cover - fallback for lightweight environments
    import hashlib

    def _keccak(data: bytes) -> bytes:
        return hashlib.sha3_256(data).digest()

    def _normalize_hex(hex_value: str) -> str:
        return hex_value[2:] if hex_value.startswith("0x") else hex_value

    def _to_checksum_address(address: str) -> str:
        stripped = _normalize_hex(address.lower())
        if len(stripped) != 40:
            raise ValueError("Address must be 40 hex characters long")
        hashed = hashlib.sha3_256(stripped.encode("ascii")).hexdigest()
        checksummed = "0x" + "".join(
            char.upper() if int(hashed[i], 16) >= 8 else char
            for i, char in enumerate(stripped)
        )
        return checksummed

    class _FallbackWeb3:
        @staticmethod
        def to_checksum_address(address: str) -> str:
            return _to_checksum_address(address)

        @staticmethod
        def keccak(
            value: bytes | None = None,
            *,
            primitive: bytes | None = None,
            hexstr: str | None = None,
            text: str | None = None,
        ) -> bytes:
            if value is not None:
                if primitive is not None or hexstr is not None or text is not None:
                    raise ValueError("Specify keccak input via positional OR keyword argument")
                primitive = value
            if primitive is not None:
                return _keccak(primitive)
            if hexstr is not None:
                return _keccak(bytes.fromhex(_normalize_hex(hexstr)))
            if text is not None:
                return _keccak(text.encode("utf-8"))
            raise ValueError("keccak requires primitive, hexstr, or text input")

    Web3 = _FallbackWeb3()  # type: ignore


BRIDGE_METADATA_TYPES = ["string", "address", "address", "uint256"]


def _normalize_hex(hex_value: str) -> str:
    return hex_value[2:] if hex_value.startswith("0x") else hex_value


def _ensure_hex_prefix(hex_value: str) -> str:
    return hex_value if hex_value.startswith("0x") else f"0x{hex_value}"


def _word_at(data: bytes, index: int) -> bytes:
    start = index * 32
    end = start + 32
    if end > len(data):
        raise ValueError("Metadata payload shorter than expected")
    return data[start:end]


def _decode_metadata_bytes(metadata_bytes: bytes) -> Dict[str, Any]:
    offset = int.from_bytes(_word_at(metadata_bytes, 0), "big")
    beneficiary_word = _word_at(metadata_bytes, 1)
    settlement_word = _word_at(metadata_bytes, 2)
    amount = int.from_bytes(_word_at(metadata_bytes, 3), "big")

    if offset >= len(metadata_bytes):
        raise ValueError("Invalid metadata offset")
    length = int.from_bytes(metadata_bytes[offset:offset + 32], "big")
    string_start = offset + 32
    string_end = string_start + length
    if string_end > len(metadata_bytes):
        raise ValueError("Metadata string length exceeds payload size")
    operation_bytes = metadata_bytes[string_start:string_end]
    operation = operation_bytes.decode("utf-8")

    beneficiary = "0x" + beneficiary_word[-20:].hex()
    settlement_vault = "0x" + settlement_word[-20:].hex()

    return {
        "operation": operation,
        "beneficiary": beneficiary,
        "settlement_vault": settlement_vault,
        "amount": amount,
    }


def _pad32(value: bytes) -> bytes:
    if len(value) > 32:
        raise ValueError("Value longer than 32 bytes")
    return b"\x00" * (32 - len(value)) + value


def _encode_metadata_bytes(operation: str, beneficiary: str, settlement_vault: str, amount: int) -> bytes:
    op_raw = operation.encode("utf-8")
    op_len = len(op_raw)
    op_padded_len = ((op_len + 31) // 32) * 32
    op_section = (
        op_len.to_bytes(32, "big")
        + op_raw
        + b"\x00" * (op_padded_len - op_len)
    )

    offset = (len(BRIDGE_METADATA_TYPES)) * 32

    beneficiary_word = _pad32(bytes.fromhex(_normalize_hex(Web3.to_checksum_address(beneficiary)))[-20:])
    settlement_word = _pad32(bytes.fromhex(_normalize_hex(Web3.to_checksum_address(settlement_vault)))[-20:])

    encoded = (
        offset.to_bytes(32, "big")
        + beneficiary_word
        + settlement_word
        + int(amount).to_bytes(32, "big")
        + op_section
    )
    return encoded


@dataclass
class BridgeEventMetadata:
    """Structured representation of NGN bridge metadata payloads."""

    operation: str
    beneficiary: str
    settlement_vault: str
    amount: int

    @classmethod
    def from_bytes(cls, metadata_bytes: bytes) -> "BridgeEventMetadata":
        """Decode raw metadata bytes emitted by the bridge contract."""
        decoded = _decode_metadata_bytes(metadata_bytes)
        return cls(
            operation=decoded["operation"],
            beneficiary=decoded["beneficiary"],
            settlement_vault=decoded["settlement_vault"],
            amount=decoded["amount"],
        )

    @classmethod
    def from_hex(cls, metadata_hex: str) -> "BridgeEventMetadata":
        """Decode metadata from a 0x-prefixed string."""
        return cls.from_bytes(bytes.fromhex(_normalize_hex(metadata_hex)))

    def as_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "beneficiary": Web3.to_checksum_address(self.beneficiary),
            "settlement_vault": Web3.to_checksum_address(self.settlement_vault),
            "amount": int(self.amount),
        }

    def to_bytes(self) -> bytes:
        return _encode_metadata_bytes(
            self.operation,
            self.beneficiary,
            self.settlement_vault,
            int(self.amount),
        )

    def hash(self) -> str:
        return _ensure_hex_prefix(Web3.keccak(self.to_bytes()).hex())


def hash_metadata_from_hex(metadata_hex: str) -> str:
    """Compute keccak256 hash of bridge metadata encoded as hex."""
    return _ensure_hex_prefix(Web3.keccak(hexstr=_normalize_hex(metadata_hex)).hex())


def decode_metadata(metadata_hex: str) -> Dict[str, Any]:
    """Decode and hash metadata for downstream ingestion."""
    meta = BridgeEventMetadata.from_hex(metadata_hex)
    data = meta.as_dict()
    data["metadata_hash"] = meta.hash()
    return data
