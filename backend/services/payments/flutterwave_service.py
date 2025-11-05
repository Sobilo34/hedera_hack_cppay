"""
Flutterwave Payment Gateway Service

Handles:
- Airtime purchases (MTN, Airtel, Glo, 9mobile)
- Bill payments (Electricity, Cable TV, Internet, Water)
- Bank transfers (NGN payments)
- Virtual account creation
- Payment verification and webhooks
"""
import os
import logging
import hashlib
import hmac
from typing import Dict, List, Optional
from decimal import Decimal
from datetime import datetime
import httpx
from decouple import config
from django.conf import settings
from django.core.cache import cache

from .oauth_token_service import get_oauth_service

logger = logging.getLogger(__name__)


class FlutterwaveService:
    """
    Flutterwave payment gateway integration
    
    Supports Nigerian payment operations:
    - Airtime: MTN, Airtel, Glo, 9mobile
    - Bills: AEDC, IKEDC, EKEDC (Electricity), DSTV, GOTV, StarTimes (Cable)
    - Bank transfers: Inter-bank transfers in Nigeria
    """
    
    BASE_URL = "https://api.flutterwave.com/v3"
    SANDBOX_URL = "https://developersandbox-api.flutterwave.com/"
    
    # Airtime providers
    AIRTIME_PROVIDERS = {
        'MTN': 'MTN Nigeria',
        'Airtel': 'Airtel Nigeria',
        'Glo': 'Glo Nigeria',
        '9mobile': '9mobile Nigeria',
    }
    
    # Electricity providers (DISCOs)
    ELECTRICITY_PROVIDERS = {
        'AEDC': 'Abuja Electricity Distribution Company',
        'IKEDC': 'Ikeja Electric',
        'EKEDC': 'Eko Electricity',
        'PHED': 'Port Harcourt Electric',
        'JED': 'Jos Electricity',
        'IBEDC': 'Ibadan Electricity',
        'KEDCO': 'Kano Electricity',
        'KAEDCO': 'Kaduna Electric',
    }
    
    # Cable TV providers
    CABLE_TV_PROVIDERS = {
        'DSTV': 'DSTV Nigeria',
        'GOTV': 'GOTV Nigeria',
        'StarTimes': 'StarTimes Nigeria',
    }
    
    # Internet providers
    INTERNET_PROVIDERS = {
        'Smile': 'Smile Telecommunications',
        'Spectranet': 'Spectranet',
    }
    
    def __init__(self):
        """Initialize Flutterwave service with OAuth 2.0 credentials"""
        # Old API key-based auth (for backwards compatibility if needed)
        self.secret_key = config('FLUTTERWAVE_SECRET_KEY', default=None)
        self.public_key = config('FLUTTERWAVE_PUBLIC_KEY', default=None)
        self.encryption_key = config('FLUTTERWAVE_ENCRYPTION_KEY', default=None)
        
        # OAuth 2.0 (new method)
        self.oauth_service = get_oauth_service()
        self.is_sandbox = config('FLUTTERWAVE_SANDBOX', default='True', cast=lambda x: x.lower() == 'true')
        
        if not self.oauth_service.client_id:
            logger.warning(
                "Flutterwave OAuth credentials not configured. "
                "Set FLUTTERWAVE_OAUTH_CLIENT_ID and FLUTTERWAVE_OAUTH_CLIENT_SECRET. "
                "Falling back to legacy secret key method."
            )
        
        self.base_url = self.SANDBOX_URL if self.is_sandbox else self.BASE_URL
        logger.info(f"Flutterwave Service initialized (sandbox: {self.is_sandbox})")
        
    def _get_headers(self) -> Dict[str, str]:
        """Generate headers for Flutterwave API requests using OAuth 2.0 token"""
        # Try to get OAuth token first
        access_token = self.oauth_service.get_access_token()
        
        if access_token:
            logger.debug("Using OAuth 2.0 access token for Flutterwave API")
            return {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            }
        
        # Fallback to legacy secret key if OAuth token not available
        if self.secret_key:
            logger.debug("Using legacy secret key for Flutterwave API (OAuth unavailable)")
            return {
                'Authorization': f'Bearer {self.secret_key}',
                'Content-Type': 'application/json',
            }
        
        logger.error("No Flutterwave authentication method available!")
        return {
            'Content-Type': 'application/json',
        }
    
    def verify_webhook_signature(self, signature: str, payload: bytes) -> bool:
        """
        Verify Flutterwave webhook signature
        
        Args:
            signature: X-Flutterwave-Signature header value
            payload: Raw request body as bytes
            
        Returns:
            bool: True if signature is valid
        """
        hash_value = hmac.new(
            self.secret_key.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(hash_value, signature)
    
    async def get_bill_categories(self) -> Dict:
        """
        Get all available bill categories
        
        Returns:
            Dict with categories list
        """
        cache_key = "flutterwave:bill_categories"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/bill-categories",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get('status') == 'success':
                    # Cache for 24 hours
                    cache.set(cache_key, data, 86400)
                    return data
                else:
                    logger.error(f"Failed to get bill categories: {data.get('message')}")
                    return {'status': 'error', 'message': data.get('message')}
                    
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave API error (bill categories): {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def buy_airtime(
        self,
        phone_number: str,
        amount: Decimal,
        provider: str,
        reference: str
    ) -> Dict:
        """
        Purchase airtime
        
        Args:
            phone_number: Phone number (format: 08012345678)
            amount: Amount in NGN (minimum 50, maximum 10000)
            provider: Provider code (MTN, Airtel, Glo, 9mobile)
            reference: Unique transaction reference
            
        Returns:
            Dict with transaction details
        """
        if provider not in self.AIRTIME_PROVIDERS:
            return {
                'status': 'error',
                'message': f'Invalid provider. Must be one of: {", ".join(self.AIRTIME_PROVIDERS.keys())}'
            }
        
        if amount < 50 or amount > 10000:
            return {
                'status': 'error',
                'message': 'Amount must be between NGN 50 and NGN 10,000'
            }
        
        payload = {
            "country": "NG",
            "customer": phone_number,
            "amount": int(amount),
            "type": provider,
            "reference": reference,
            "recurrence": "ONCE"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Airtime purchase response: {data}")
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave airtime purchase error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def pay_electricity_bill(
        self,
        customer_id: str,
        amount: Decimal,
        provider: str,
        meter_type: str,  # 'prepaid' or 'postpaid'
        reference: str
    ) -> Dict:
        """
        Pay electricity bill
        
        Args:
            customer_id: Meter number
            amount: Amount in NGN
            provider: DISCO code (AEDC, IKEDC, EKEDC, etc.)
            meter_type: 'prepaid' or 'postpaid'
            reference: Unique transaction reference
            
        Returns:
            Dict with transaction details including token for prepaid
        """
        if provider not in self.ELECTRICITY_PROVIDERS:
            return {
                'status': 'error',
                'message': f'Invalid provider. Must be one of: {", ".join(self.ELECTRICITY_PROVIDERS.keys())}'
            }
        
        if meter_type not in ['prepaid', 'postpaid']:
            return {'status': 'error', 'message': 'meter_type must be "prepaid" or "postpaid"'}
        
        # First validate the meter number
        validation = await self.validate_bill_service(provider, customer_id, 'BIL099')
        if validation.get('status') != 'success':
            return validation
        
        payload = {
            "country": "NG",
            "customer": customer_id,
            "amount": int(amount),
            "type": f"{provider}",
            "reference": reference,
            "recurrence": "ONCE"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Electricity bill payment response: {data}")
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave electricity payment error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def pay_cable_tv(
        self,
        smartcard_number: str,
        amount: Decimal,
        provider: str,
        bouquet_code: str,
        reference: str
    ) -> Dict:
        """
        Pay for cable TV subscription
        
        Args:
            smartcard_number: Smartcard/IUC number
            amount: Amount in NGN
            provider: Provider code (DSTV, GOTV, StarTimes)
            bouquet_code: Package code (e.g., 'dstv-compact')
            reference: Unique transaction reference
            
        Returns:
            Dict with transaction details
        """
        if provider not in self.CABLE_TV_PROVIDERS:
            return {
                'status': 'error',
                'message': f'Invalid provider. Must be one of: {", ".join(self.CABLE_TV_PROVIDERS.keys())}'
            }
        
        # Validate smartcard number
        validation = await self.validate_bill_service(provider, smartcard_number, 'BIL114')
        if validation.get('status') != 'success':
            return validation
        
        payload = {
            "country": "NG",
            "customer": smartcard_number,
            "amount": int(amount),
            "type": provider,
            "reference": reference,
            "recurrence": "ONCE"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Cable TV payment response: {data}")
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave cable TV payment error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def validate_bill_service(
        self,
        provider: str,
        customer_id: str,
        item_code: str
    ) -> Dict:
        """
        Validate customer ID for bill payment
        
        Args:
            provider: Provider code
            customer_id: Customer ID to validate (meter number, smartcard, etc.)
            item_code: Bill item code
            
        Returns:
            Dict with customer details if valid
        """
        payload = {
            "item_code": item_code,
            "code": customer_id,
            "customer": customer_id
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bill-items/{item_code}/validate",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave validation error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def create_bank_transfer(
        self,
        account_bank: str,  # Bank code
        account_number: str,
        amount: Decimal,
        narration: str,
        reference: str,
        beneficiary_name: Optional[str] = None
    ) -> Dict:
        """
        Transfer money to Nigerian bank account
        
        Args:
            account_bank: Bank code (e.g., '044' for Access Bank)
            account_number: 10-digit account number
            amount: Amount in NGN
            narration: Transaction description
            reference: Unique transaction reference
            beneficiary_name: Optional beneficiary name
            
        Returns:
            Dict with transfer details
        """
        payload = {
            "account_bank": account_bank,
            "account_number": account_number,
            "amount": int(amount),
            "narration": narration,
            "currency": "NGN",
            "reference": reference,
            "debit_currency": "NGN"
        }
        
        if beneficiary_name:
            payload["beneficiary_name"] = beneficiary_name
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/transfers",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Bank transfer response: {data}")
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave bank transfer error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def verify_transaction(self, transaction_id: int) -> Dict:
        """
        Verify a transaction status
        
        Args:
            transaction_id: Flutterwave transaction ID
            
        Returns:
            Dict with transaction status and details
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transactions/{transaction_id}/verify",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave verification error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_nigerian_banks(self) -> List[Dict]:
        """
        Get list of Nigerian banks
        
        Returns:
            List of banks with codes and names
        """
        cache_key = "flutterwave:nigerian_banks"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/banks/NG",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get('status') == 'success':
                    banks = data.get('data', [])
                    # Cache for 7 days
                    cache.set(cache_key, banks, 604800)
                    return banks
                else:
                    return []
                    
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave banks list error: {e}")
            return []
    
    async def resolve_account_number(
        self,
        account_number: str,
        account_bank: str
    ) -> Dict:
        """
        Resolve account number to get account name
        
        Args:
            account_number: 10-digit account number
            account_bank: Bank code
            
        Returns:
            Dict with account details
        """
        payload = {
            "account_number": account_number,
            "account_bank": account_bank
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/wallets/account-resolve",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Flutterwave account resolution error: {e}")
            return {'status': 'error', 'message': str(e)}
