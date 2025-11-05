"""End-to-end CPPay transaction flow harness.

This script exercises the public FastAPI endpoints in the same order
that a judge or real user would interact with the platform:

1. Authenticate and obtain a bearer token.
2. Ensure the smart account for the supplied EOA exists (predict + inspect).
3. Queue a UserOperation with the bundler gateway and poll for inclusion.
4. Request a crypto-to-fiat payment estimate.
5. Execute airtime purchase, data purchase, and bank transfer flows.

The script only relies on environment variables for secrets or chain-
specific values so it can be safely shared.  Run it with:

    python backend/tests/test_end_to_end_flow.py

Key environment variables (defaults shown where safe):

- CPPAY_API_BASE (default: http://localhost:8000)
- CPPAY_EMAIL (default: bilalsolih@gmail.com)
- CPPAY_PASSWORD (default: Sobil#34)
- CPPAY_EOA_ADDRESS (default: 0x4e94F8Dfc57dF2f1433e3679f6Bcb427aF73f1ce)
- CPPAY_CHAIN_ID (default: 4202)
- CPPAY_CHAIN_NAME (default: lisk-sepolia)
- CPPAY_BUNDLER_ENDPOINT (required for bundler step)
- CPPAY_USER_OP_HASH (required for bundler step)
- CPPAY_USER_OP_NONCE (default: 0x0)
- CPPAY_USER_OP_CALLDATA (optional hex string)
- CPPAY_PHONE_NUMBER (default: 09134422033)
- CPPAY_AIRTIME_PROVIDER (default: MTN)
- CPPAY_AIRTIME_AMOUNT (default: 1000)
- CPPAY_CRYPTO_TOKEN (default: ETH)
- CPPAY_DATA_PLAN_ID (default: MTN-500MB)
- CPPAY_DATA_AMOUNT (default: 500)
- CPPAY_BANK_CODE (default: 058)
- CPPAY_ACCOUNT_NUMBER (default: 0000000000)
- CPPAY_BANK_AMOUNT (default: 1000)
- CPPAY_BENEFICIARY_NAME (default: Test Beneficiary)
- CPPAY_TRANSFER_NARRATION (default: CPPay Demo Transfer)

The script emits structured logs of every request and response payload so
reviewers have a verifiable audit trail.  Adjust the environment values
for real credentials, bundler metadata, and Paystack-ready bank details.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx


logger = logging.getLogger("cppay.flow")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)


@dataclass(slots=True)
class FlowConfig:
    """Runtime configuration sourced from environment variables."""

    api_base: str = os.getenv("CPPAY_API_BASE", "http://localhost:8000")
    email: str = os.getenv("CPPAY_EMAIL", "bilalsolih@gmail.com")
    password: str = os.getenv("CPPAY_PASSWORD", "Sobil#34")
    eoa_address: str = os.getenv(
        "CPPAY_EOA_ADDRESS", "0x4e94F8Dfc57dF2f1433e3679f6Bcb427aF73f1ce"
    )
    chain_id: int = int(os.getenv("CPPAY_CHAIN_ID", "4202"))
    chain_name: str = os.getenv("CPPAY_CHAIN_NAME", "lisk-sepolia")
    bundler_endpoint: Optional[str] = os.getenv("CPPAY_BUNDLER_ENDPOINT")
    user_op_hash: Optional[str] = os.getenv("CPPAY_USER_OP_HASH")
    user_op_nonce: str = os.getenv("CPPAY_USER_OP_NONCE", "0x0")
    user_op_call_data: Optional[str] = os.getenv("CPPAY_USER_OP_CALLDATA")
    smart_account_address: Optional[str] = os.getenv("CPPAY_SMART_ACCOUNT_ADDRESS")

    phone_number: str = os.getenv("CPPAY_PHONE_NUMBER", "09134422033")
    airtime_provider: str = os.getenv("CPPAY_AIRTIME_PROVIDER", "MTN")
    airtime_amount: str = os.getenv("CPPAY_AIRTIME_AMOUNT", "1000")
    crypto_token: str = os.getenv("CPPAY_CRYPTO_TOKEN", "ETH")

    data_plan_id: str = os.getenv("CPPAY_DATA_PLAN_ID", "MTN-500MB")
    data_amount: str = os.getenv("CPPAY_DATA_AMOUNT", "500")

    bank_code: str = os.getenv("CPPAY_BANK_CODE", "058")
    account_number: str = os.getenv("CPPAY_ACCOUNT_NUMBER", "0000000000")
    bank_amount: str = os.getenv("CPPAY_BANK_AMOUNT", "1000")
    beneficiary_name: str = os.getenv("CPPAY_BENEFICIARY_NAME", "Test Beneficiary")
    transfer_narration: str = os.getenv(
        "CPPAY_TRANSFER_NARRATION", "CPPay Demo Transfer"
    )

    extra_metadata: Dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        """Ensure required data exists before running expensive steps."""
        if not self.bundler_endpoint:
            raise ValueError(
                "CPPAY_BUNDLER_ENDPOINT is required to queue the user operation"
            )
        if not self.user_op_hash:
            raise ValueError("CPPAY_USER_OP_HASH must be set for bundler queuing")


class FlowRunner:
    """Coordinates the end-to-end user journey."""

    def __init__(self, config: FlowConfig) -> None:
        self.config = config
        self.token: Optional[str] = None
        self.client = httpx.AsyncClient(base_url=config.api_base, timeout=60.0)
        self.smart_account: Optional[str] = config.smart_account_address
        self.operation_id: Optional[str] = None
        self.job_id: Optional[str] = None
        self.estimate: Optional[Dict[str, Any]] = None

    async def close(self) -> None:
        await self.client.aclose()

    async def authenticate(self) -> None:
        payload = {"email": self.config.email, "password": self.config.password}
        response = await self.client.post("/api/v1/auth/login", json=payload)
        self._log_exchange("POST", "/api/v1/auth/login", payload, response)
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        masked = f"{self.token[:12]}…{self.token[-6:]}"
        logger.info("Authenticated. Access token: %s", masked)
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    async def ensure_smart_account(self) -> None:
        if not self.smart_account:
            payload = {"eoa_address": self.config.eoa_address, "chain_id": self.config.chain_id}
            response = await self.client.post(
                "/api/v1/blockchain/smart-account/predict", json=payload
            )
            self._log_exchange(
                "POST", "/api/v1/blockchain/smart-account/predict", payload, response
            )
            response.raise_for_status()
            data = response.json()
            self.smart_account = data["smart_account_address"]
            logger.info("Predicted smart account: %s", self.smart_account)

        info_path = f"/api/v1/blockchain/smart-account/info/{self.smart_account}/{self.config.chain_id}"
        response = await self.client.get(info_path)
        self._log_exchange("GET", info_path, None, response)
        response.raise_for_status()
        info = response.json()
        status_label = "deployed" if info.get("deployed") else "not deployed"
        logger.info(
            "Smart account status: %s | balance=%s", status_label, info.get("balance")
        )

    async def queue_user_operation(self) -> None:
        payload = {
            "chain_id": self.config.chain_id,
            "sender": self.smart_account,
            "user_op_hash": self.config.user_op_hash,
            "nonce": self.config.user_op_nonce,
            "endpoint": self.config.bundler_endpoint,
            "metadata": {
                "flow": "cppay-end-to-end",
                "notes": "Queued via automated test harness",
                **self.config.extra_metadata,
            },
        }
        if self.config.user_op_call_data:
            payload["payload"] = {"call_data": self.config.user_op_call_data}
        response = await self.client.post("/api/v1/bundler/operations", json=payload)
        self._log_exchange("POST", "/api/v1/bundler/operations", payload, response)
        response.raise_for_status()
        data = response.json()
        self.operation_id = str(data["operation_id"])
        self.job_id = str(data["job_id"])
        logger.info(
            "Queued user operation %s (job %s)", self.operation_id, self.job_id
        )

    async def poll_for_inclusion(self, timeout: int = 300, interval: int = 10) -> None:
        assert self.operation_id, "Operation ID unavailable; queue step must succeed"
        path = f"/api/v1/bundler/operations/{self.operation_id}"
        elapsed = 0
        while elapsed <= timeout:
            response = await self.client.get(path)
            self._log_exchange("GET", path, None, response)
            response.raise_for_status()
            data = response.json()
            status = data.get("status")
            logger.info("Bundler status: %s (elapsed=%ss)", status, elapsed)
            if status in {"INCLUDED", "FAILED"}:
                if status == "FAILED":
                    raise RuntimeError(
                        f"User operation {self.operation_id} failed: {data.get('last_error')}"
                    )
                logger.info(
                    "Operation %s included on-chain. Metadata: %s",
                    self.operation_id,
                    json.dumps(data.get("metadata", {}), indent=2),
                )
                return
            await asyncio.sleep(interval)
            elapsed += interval
        raise TimeoutError(
            f"Timeout waiting for user operation {self.operation_id} to be included"
        )

    async def request_payment_estimate(self) -> None:
        payload = {
            "payment_type": "airtime",
            "fiat_amount": str(self.config.airtime_amount),
            "crypto_token": self.config.crypto_token,
            "chain": self.config.chain_name,
        }
        response = await self.client.post("/api/v1/payments/estimate", json=payload)
        self._log_exchange("POST", "/api/v1/payments/estimate", payload, response)
        response.raise_for_status()
        self.estimate = response.json()
        logger.info("Payment estimate: %s", json.dumps(self.estimate, indent=2))

    async def buy_airtime(self) -> None:
        if not self.estimate:
            raise RuntimeError("Payment estimate missing; run estimate step first")
        crypto_amount = self.estimate.get("crypto_amount_needed")
        payload = {
            "phone_number": self.config.phone_number,
            "amount": str(self.config.airtime_amount),
            "provider": self.config.airtime_provider,
            "crypto_token": self.config.crypto_token,
            "crypto_amount": str(crypto_amount),
            "chain": self.config.chain_name,
            "user_address": self.smart_account,
        }
        response = await self.client.post("/api/v1/payments/airtime/buy", json=payload)
        self._log_exchange("POST", "/api/v1/payments/airtime/buy", payload, response)
        response.raise_for_status()
        logger.info("Airtime purchase response: %s", response.text)

    async def buy_data(self) -> None:
        payload = {
            "phone_number": self.config.phone_number,
            "data_plan_id": self.config.data_plan_id,
            "amount": str(self.config.data_amount),
            "provider": self.config.airtime_provider,
            "token_address": None,
            "from_token": self.config.crypto_token,
            "blockchain_network": self.config.chain_name,
            "transaction_hash": None,
        }
        response = await self.client.post("/api/v1/payments/data/purchase", json=payload)
        self._log_exchange("POST", "/api/v1/payments/data/purchase", payload, response)
        response.raise_for_status()
        logger.info("Data purchase response: %s", response.text)

    async def transfer_bank(self) -> None:
        payload = {
            "account_number": self.config.account_number,
            "bank_code": self.config.bank_code,
            "amount": str(self.config.bank_amount),
            "beneficiary_name": self.config.beneficiary_name,
            "narration": self.config.transfer_narration,
            "crypto_token": self.config.crypto_token,
            "crypto_amount": str(self.estimate.get("crypto_amount_needed")) if self.estimate else None,
            "chain": self.config.chain_name,
            "user_address": self.smart_account,
        }
        response = await self.client.post("/api/v1/payments/transfer/bank", json=payload)
        self._log_exchange("POST", "/api/v1/payments/transfer/bank", payload, response)
        response.raise_for_status()
        logger.info("Bank transfer response: %s", response.text)

    async def run(self) -> None:
        await self.authenticate()
        await self.ensure_smart_account()
        await self.queue_user_operation()
        await self.poll_for_inclusion()
        await self.request_payment_estimate()
        await self.buy_airtime()
        await self.buy_data()
        await self.transfer_bank()
        logger.info("✅ End-to-end flow completed successfully")

    @staticmethod
    def _log_exchange(method: str, path: str, payload: Optional[Any], response: httpx.Response) -> None:
        formatted_payload = json.dumps(payload, indent=2) if payload is not None else "<none>"
        try:
            parsed = response.json()
            formatted_response = json.dumps(parsed, indent=2)
        except ValueError:
            formatted_response = response.text
        logger.info(
            "\n→ %s %s\nPayload:%s\n← %s %s\nResponse:%s\n",
            method,
            path,
            formatted_payload,
            response.status_code,
            response.reason_phrase,
            formatted_response,
        )


def _decimal_to_str(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Decimal instances into strings for safe JSON logging."""
    cleaned: Dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, Decimal):
            cleaned[key] = str(value)
        elif isinstance(value, dict):
            cleaned[key] = _decimal_to_str(value)
        else:
            cleaned[key] = value
    return cleaned


async def main() -> None:
    config = FlowConfig()
    config.validate()
    runner = FlowRunner(config)
    try:
        await runner.run()
    finally:
        await runner.close()


if __name__ == "__main__":
    asyncio.run(main())
