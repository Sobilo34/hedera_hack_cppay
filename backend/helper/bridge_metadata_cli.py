#!/usr/bin/env python3
"""CLI for decoding NGN bridge metadata payloads."""

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from services.blockchain.bridge_event_service import (  # noqa: E402
    decode_metadata,
    hash_metadata_from_hex,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Decode or hash NGN bridge metadata")
    parser.add_argument("metadata", help="Metadata payload (0x-prefixed hex string)")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output decoded data as JSON",
    )
    parser.add_argument(
        "--hash-only",
        action="store_true",
        help="Only output the metadata hash",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata_hex: str = args.metadata

    if args.hash_only:
        result = hash_metadata_from_hex(metadata_hex)
        print(result)
        return

    decoded = decode_metadata(metadata_hex)

    if args.json:
        print(json.dumps(decoded))
    else:
        print(
            json.dumps(
                decoded,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
