"""Utility helpers for loading compiled contract ABIs."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

BASE_PATH = Path(__file__).resolve().parent / 'abis'


class MissingABIError(FileNotFoundError):
    """Raised when an expected contract ABI bundle is missing."""


@lru_cache(maxsize=16)
def load_contract_interface(contract_name: str) -> Dict[str, Any]:
    """Return the ABI bundle for the requested contract from the packaging directory."""
    filename = BASE_PATH / f"{contract_name}.json"
    if not filename.exists():
        raise MissingABIError(f"ABI bundle not found for contract '{contract_name}'")

    with filename.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def clear_cache() -> None:
    """Reset the ABI cache (mainly useful in tests)."""
    load_contract_interface.cache_clear()
