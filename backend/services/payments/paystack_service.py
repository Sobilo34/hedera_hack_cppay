"""
Paystack Payment Gateway Service

Official Documentation: https://paystack.com/docs/api/

Features implemented for CPPay backend:
- Airtime, electricity, and cable TV bill purchases (Paystack Billers API)
- Nigerian bank account resolution and bank directory
- Bank transfers (recipient creation + transfer initiation)
- Transaction verification utilities
- Webhook signature verification helper

All requests run against Paystack's live endpoints using test API keys.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Dict, List, Optional

import httpx
from decouple import config
from django.core.cache import cache

logger = logging.getLogger(__name__)


class PaystackService:
    """Async Paystack API client tailored for CPPay."""

    BASE_URL = "https://api.paystack.co"
    DEFAULT_TIMEOUT = 30.0

    BILLERS_CACHE_KEY = "paystack:billers"
    BILLERS_CACHE_TTL = 60 * 60  # 1 hour
    RECIPIENT_CACHE_TTL = 60 * 60 * 24  # 24 hours

    CATEGORY_MAP = {
        'airtime': {'airtime', 'airtime & data', 'mobile airtime'},
        'electricity': {'electricity', 'power', 'utilities'},
        'cable_tv': {'cable tv', 'cable-tv', 'tv', 'paytv'},
    }

    def __init__(self) -> None:
        self.secret_key = config('PAYSTACK_SECRET_KEY', default=None)
        self.public_key = config('PAYSTACK_PUBLIC_KEY', default=None)

        if not self.secret_key:
            logger.warning(
                "Paystack secret key not configured. Set PAYSTACK_SECRET_KEY in .env. "
                "Get it from https://paystack.com → Settings → API Keys"
            )

        logger.info("Paystack Service initialised")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _get_headers(self) -> Dict[str, str]:
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    @staticmethod
    def _extract_json(response: httpx.Response) -> Dict:
        try:
            return response.json()
        except ValueError:
            return {
                'status': False,
                'message': response.text or 'Unable to parse Paystack response',
                'data': None,
            }

    @staticmethod
    def _format_response(payload: Dict, *, success_override: Optional[bool] = None) -> Dict:
        if payload is None:
            return {
                'status': 'error',
                'message': 'Empty response from Paystack',
                'data': None,
            }

        if success_override is None:
            success = bool(payload.get('status'))
        else:
            success = success_override

        if success:
            return {
                'status': 'success',
                'message': payload.get('message', 'Request successful'),
                'data': payload.get('data'),
                'meta': payload.get('meta'),
                'raw': payload,
            }

        return {
            'status': 'error',
            'message': payload.get('message', 'Request failed'),
            'data': payload.get('data'),
            'errors': payload.get('errors') or payload.get('error'),
            'raw': payload,
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None,
        timeout: Optional[float] = None,
    ) -> Dict:
        url = f"{self.BASE_URL}{path}"
        headers = self._get_headers()
        timeout_value = timeout or self.DEFAULT_TIMEOUT

        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    headers=headers,
                    timeout=timeout_value
                )
                response.raise_for_status()
                payload = self._extract_json(response)
                return self._format_response(payload)
            except httpx.HTTPStatusError as exc:
                payload = self._extract_json(exc.response)
                logger.error(
                    "Paystack API error %s %s: %s",
                    method.upper(),
                    path,
                    payload.get('message')
                )
                return self._format_response(payload, success_override=False)
            except Exception as exc:  # pylint: disable=broad-except
                logger.exception("Unhandled Paystack request error: %s", exc)
                return {
                    'status': 'error',
                    'message': str(exc),
                    'data': None,
                }

    # ------------------------------------------------------------------
    # Webhook helper
    # ------------------------------------------------------------------
    def verify_webhook_signature(self, signature: str, payload: bytes) -> bool:
        """Validate X-Paystack-Signature header."""
        if not self.secret_key:
            return False

        hash_value = hmac.new(
            self.secret_key.encode('utf-8'),
            payload,
            hashlib.sha512
        ).hexdigest()

        return hmac.compare_digest(hash_value, signature)

    # ------------------------------------------------------------------
    # Miscellaneous endpoints
    # ------------------------------------------------------------------
    async def resolve_account_number(self, account_number: str, bank_code: str) -> Dict:
        """
        Resolve bank account.
        Endpoint: GET /bank/resolve
        https://paystack.com/docs/api/miscellaneous/#resolve-account-number
        """
        params = {
            'account_number': account_number,
            'bank_code': bank_code,
        }
        return await self._request('GET', '/bank/resolve', params=params)

    async def get_banks(self) -> Dict:
        """
        List Nigerian banks.
        Endpoint: GET /bank
        https://paystack.com/docs/api/miscellaneous/#list-banks
        """
        cache_key = 'paystack:banks'
        cached = cache.get(cache_key)
        if cached:
            return {
                'status': 'success',
                'message': 'Banks list (cached)',
                'data': cached,
            }

        response = await self._request('GET', '/bank', params={'perPage': 500})
        if response.get('status') == 'success':
            cache.set(cache_key, response.get('data', []), 86400)
        return response

    # ------------------------------------------------------------------
    # Transfer helpers
    # ------------------------------------------------------------------
    async def _create_transfer_recipient(
        self,
        *,
        account_number: str,
        bank_code: str,
        beneficiary_name: Optional[str] = None,
    ) -> Dict:
        cache_key = f"paystack:recipient:{bank_code}:{account_number}"
        cached = cache.get(cache_key)
        if cached:
            return {
                'status': 'success',
                'message': 'Recipient retrieved from cache',
                'data': cached,
            }

        payload = {
            'type': 'nuban',
            'name': beneficiary_name or 'CPPay Recipient',
            'account_number': account_number,
            'bank_code': bank_code,
            'currency': 'NGN',
        }

        response = await self._request('POST', '/transferrecipient', json=payload)
        if response.get('status') == 'success':
            data = response.get('data') or {}
            cache.set(cache_key, data, self.RECIPIENT_CACHE_TTL)
        return response

    async def get_transfer_fee(self, amount: float) -> Dict:
        """
        Check transfer fee (GET /transfer/fee_check).
        """
        params = {
            'amount': int(Decimal(amount) * 100),
        }
        return await self._request('GET', '/transfer/fee_check', params=params)

    async def initiate_transfer(
        self,
        *,
        account_number: str,
        bank_code: str,
        amount: float,
        reason: str,
        reference: str,
        beneficiary_name: Optional[str] = None,
    ) -> Dict:
        """Initiate bank transfer (POST /transfer)."""
        recipient_response = await self._create_transfer_recipient(
            account_number=account_number,
            bank_code=bank_code,
            beneficiary_name=beneficiary_name,
        )

        if recipient_response.get('status') != 'success':
            return recipient_response

        recipient_data = recipient_response.get('data') or {}
        recipient_code = (
            recipient_data.get('recipient_code')
            or recipient_data.get('recipient')
            or recipient_data.get('code')
        )

        if not recipient_code:
            return {
                'status': 'error',
                'message': 'Unable to determine Paystack recipient code',
                'data': recipient_data,
            }

        payload = {
            'source': 'balance',
            'amount': int(Decimal(amount) * 100),
            'reference': reference,
            'reason': reason,
            'currency': 'NGN',
            'recipient': recipient_code,
        }

        return await self._request('POST', '/transfer', json=payload)

    async def verify_transfer(self, reference: str) -> Dict:
        """Verify transfer status (GET /transfer/verify/{reference})."""
        return await self._request('GET', f'/transfer/verify/{reference}')

    # ------------------------------------------------------------------
    # Biller utilities
    # ------------------------------------------------------------------
    async def _get_billers(self, *, force_refresh: bool = False) -> List[Dict]:
        if not force_refresh:
            cached = cache.get(self.BILLERS_CACHE_KEY)
            if cached:
                return cached

        response = await self._request('GET', '/billers', params={'perPage': 500})
        if response.get('status') == 'success' and isinstance(response.get('data'), list):
            billers = response['data']
            cache.set(self.BILLERS_CACHE_KEY, billers, self.BILLERS_CACHE_TTL)
            return billers

        return response.get('data') or []

    async def _find_biller(self, provider: str, category_key: str) -> Optional[Dict]:
        provider_lower = provider.lower()
        categories = {c.lower() for c in self.CATEGORY_MAP.get(category_key, set())}

        billers = await self._get_billers()
        for biller in billers:
            name = (biller.get('name') or '').lower()
            short_name = (biller.get('short_name') or '').lower()
            category = (biller.get('category') or biller.get('type') or '').lower()

            if categories and category not in categories:
                continue

            if provider_lower in name or provider_lower in short_name:
                return biller

        logger.warning("No Paystack biller matched provider=%s category=%s", provider, category_key)
        return None

    async def list_billers(self) -> Dict:
        """Expose cached Paystack billers."""
        billers = await self._get_billers()
        return {
            'status': 'success',
            'message': 'Billers fetched',
            'data': billers,
        }

    async def check_biller_status(self, reference: str) -> Dict:
        """Check bill payment status (GET /billers/status/{reference})."""
        return await self._request('GET', f'/billers/status/{reference}')

    async def _purchase_biller_item(
        self,
        *,
        biller: Dict,
        customer: str,
        amount: Decimal,
        customer_email: str,
        reference: str,
        metadata: Optional[Dict] = None,
        item_code: Optional[str] = None,
    ) -> Dict:
        payload = {
            'code': biller.get('code'),
            'customer': customer,
            'email': customer_email,
            'amount': int(Decimal(amount) * 100),
            'currency': biller.get('currency', 'NGN'),
            'reference': reference,
        }

        if item_code:
            payload['item_code'] = item_code

        if metadata:
            payload['metadata'] = metadata

        return await self._request('POST', '/billers/purchase', json=payload)

    async def purchase_airtime(
        self,
        *,
        phone_number: str,
        amount: float,
        provider: str,
        customer_email: str,
        reference: str,
    ) -> Dict:
        biller = await self._find_biller(provider, 'airtime')
        if not biller:
            return {
                'status': 'error',
                'message': f'Airtime provider not supported on Paystack: {provider}',
                'data': None,
            }

        metadata = {
            'provider': provider,
            'phone_number': phone_number,
        }

        return await self._purchase_biller_item(
            biller=biller,
            customer=phone_number,
            amount=Decimal(amount),
            customer_email=customer_email,
            reference=reference,
            metadata=metadata,
        )

    async def pay_electricity(
        self,
        *,
        meter_number: str,
        amount: float,
        provider: str,
        customer_email: str,
        meter_type: str,
        reference: str,
    ) -> Dict:
        biller = await self._find_biller(provider, 'electricity')
        if not biller:
            return {
                'status': 'error',
                'message': f'Electricity provider not supported on Paystack: {provider}',
                'data': None,
            }

        metadata = {
            'provider': provider,
            'meter_type': meter_type,
        }

        return await self._purchase_biller_item(
            biller=biller,
            customer=meter_number,
            amount=Decimal(amount),
            customer_email=customer_email,
            reference=reference,
            metadata=metadata,
        )

    async def pay_cable_tv(
        self,
        *,
        smart_card_number: str,
        amount: float,
        provider: str,
        customer_email: str,
        bouquet_code: Optional[str],
        reference: str,
    ) -> Dict:
        biller = await self._find_biller(provider, 'cable_tv')
        if not biller:
            return {
                'status': 'error',
                'message': f'Cable TV provider not supported on Paystack: {provider}',
                'data': None,
            }

        metadata = {
            'provider': provider,
            'smartcard_number': smart_card_number,
        }

        return await self._purchase_biller_item(
            biller=biller,
            customer=smart_card_number,
            amount=Decimal(amount),
            customer_email=customer_email,
            reference=reference,
            metadata=metadata,
            item_code=bouquet_code,
        )

    # ------------------------------------------------------------------
    # Transaction verification
    # ------------------------------------------------------------------
    async def verify_transaction(self, reference: str) -> Dict:
        """Verify any Paystack transaction by reference."""
        return await self._request('GET', f'/transaction/verify/{reference}')


_paystack_service: Optional[PaystackService] = None


def get_paystack_service() -> PaystackService:
    global _paystack_service  # pylint: disable=global-statement
    if _paystack_service is None:
        _paystack_service = PaystackService()
    return _paystack_service
