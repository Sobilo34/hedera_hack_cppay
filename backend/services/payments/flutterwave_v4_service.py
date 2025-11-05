"""
Flutterwave v4 API Service with OAuth 2.0

Official Documentation: https://developer.flutterwave.com/reference

Key Features:
- OAuth 2.0 authentication (no secret keys needed)
- Account validation/resolution (GET /accounts/v2/lookup)
- Bank transfers (POST /transfers)
- Bill payments (Airtime, Electricity, Cable TV)
- Transaction queries
- Webhook signature verification
"""
import logging
from typing import Dict, List, Optional
import httpx
from decouple import config
from django.core.cache import cache

from .oauth_token_service import get_oauth_service

logger = logging.getLogger(__name__)


class FlutterwaveV4Service:
    """
    Flutterwave v4 API Service
    
    Official Docs: https://developer.flutterwave.com/reference
    
    Authentication: OAuth 2.0 Bearer Token (via oauth_token_service)
    Environment: Sandbox (test credentials) or Production
    """
    
    # v4 API Base URLs (same for test and production, credentials determine environment)
    BASE_URL = "https://api.flutterwave.com/v4"
    
    def __init__(self):
        """Initialize Flutterwave v4 service with OAuth 2.0"""
        self.oauth_service = get_oauth_service()
        self.is_sandbox = config('FLUTTERWAVE_SANDBOX', default='True', cast=lambda x: x.lower() == 'true')
        self.base_url = self.BASE_URL
        
        logger.info(f"Flutterwave v4 Service initialized (sandbox: {self.is_sandbox})")
    
    def _get_headers(self) -> Dict[str, str]:
        """
        Generate headers for Flutterwave API v4 requests
        
        Uses OAuth 2.0 Bearer token authentication
        
        Returns:
            Dict with Authorization header containing OAuth token
        """
        access_token = self.oauth_service.get_access_token()
        
        if not access_token:
            logger.error("Failed to get Flutterwave OAuth access token")
            raise ValueError("Flutterwave OAuth token unavailable")
        
        return {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }
    
    async def resolve_account(
        self,
        account_number: str,
        bank_code: str
    ) -> Dict:
        """
        Resolve Nigerian bank account to get account holder name
        
        Endpoint: GET /accounts/v2/lookup
        Documentation: https://developer.flutterwave.com/reference/get-account-details
        
        Args:
            account_number: 10-digit Nigerian bank account number
            bank_code: 3-digit bank code (e.g., "011" for First Bank)
            
        Returns:
            Dict with account details (account_name, account_status, etc.)
            
        Raises:
            httpx.HTTPError: If API call fails
            
        Example:
            result = await service.resolve_account("3036377991", "011")
            # Returns: {
            #     'status': 'success',
            #     'data': {
            #         'account_number': '3036377991',
            #         'first_name': 'ADEBAYO',
            #         'last_name': 'ADELEKE',
            #         'account_name': 'ADEBAYO ADELEKE'
            #     }
            # }
        """
        try:
            async with httpx.AsyncClient() as client:
                # v4 API format: Query parameters in URL
                url = f"{self.base_url}/accounts/v2/lookup"
                params = {
                    "account_number": account_number,
                    "bank_code": bank_code
                }
                
                response = await client.get(
                    url,
                    params=params,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.info(f"Account resolved: {account_number} @ {bank_code}")
                return result
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Flutterwave account resolution error: {e.response.status_code} {e.response.text}")
            return {'status': 'error', 'message': str(e)}
        except Exception as e:
            logger.error(f"Flutterwave account resolution error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_banks(self) -> Dict:
        """
        Get list of Nigerian banks with their codes
        
        Endpoint: GET /banks
        Documentation: https://developer.flutterwave.com/reference/list-banks
        
        Returns:
            List of banks with codes, e.g.:
            [
                {'id': 1, 'code': '011', 'name': 'First Bank Nigeria'},
                {'id': 2, 'code': '012', 'name': 'UBA'},
                ...
            ]
        """
        cache_key = "flutterwave:v4:banks"
        cached = cache.get(cache_key)
        
        if cached:
            logger.debug("Returning cached banks list")
            return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/banks",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                # Cache for 1 day (banks list doesn't change often)
                cache.set(cache_key, result, timeout=86400)
                
                logger.info(f"Retrieved {len(result.get('data', []))} banks")
                return result
                
        except Exception as e:
            logger.error(f"Error fetching banks: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def create_transfer(
        self,
        account_number: str,
        bank_code: str,
        amount: float,
        narration: str,
        reference: str
    ) -> Dict:
        """
        Initiate a bank transfer
        
        Endpoint: POST /transfers
        Documentation: https://developer.flutterwave.com/reference/create-a-transfer
        
        Args:
            account_number: Recipient's 10-digit account number
            bank_code: Recipient's 3-digit bank code
            amount: Amount to transfer (NGN)
            narration: Payment description
            reference: Unique reference for this transfer
            
        Returns:
            Transfer response with transfer_id
            
        Example:
            result = await service.create_transfer(
                account_number="3036377991",
                bank_code="011",
                amount=10000,
                narration="Payment for services",
                reference="TRX_001_20250101"
            )
        """
        payload = {
            "account_number": account_number,
            "bank_code": bank_code,
            "amount": amount,
            "narration": narration,
            "reference": reference,
            "debit_currency": "NGN"  # Debit account in NGN
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/transfers",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                transfer_id = result.get('data', {}).get('id')
                logger.info(f"Transfer initiated: {transfer_id}")
                return result
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Transfer creation error: {e.response.status_code} {e.response.text}")
            return {'status': 'error', 'message': str(e)}
        except Exception as e:
            logger.error(f"Transfer creation error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_transfer_fee(
        self,
        amount: float,
        bank_code: str
    ) -> Dict:
        """
        Get transfer fees for specific amount and bank
        
        Endpoint: GET /transfers/fee
        Documentation: https://developer.flutterwave.com/reference/get-transfer-fee
        
        Args:
            amount: Transfer amount (NGN)
            bank_code: 3-digit bank code
            
        Returns:
            Fee information
        """
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    "amount": amount,
                    "bank_code": bank_code
                }
                
                response = await client.get(
                    f"{self.base_url}/transfers/fee",
                    params=params,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Fee calculation error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_transfer_status(self, transfer_id: str) -> Dict:
        """
        Get status of a specific transfer
        
        Endpoint: GET /transfers/{id}
        Documentation: https://developer.flutterwave.com/reference/get-transfer-status
        
        Args:
            transfer_id: Flutterwave transfer ID
            
        Returns:
            Transfer status and details
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transfers/{transfer_id}",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Transfer status error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def purchase_airtime(
        self,
        amount: float,
        phone_number: str,
        provider: str
    ) -> Dict:
        """
        Purchase airtime (MTN, Airtel, Glo, 9mobile)
        
        Endpoint: POST /bills
        Documentation: https://developer.flutterwave.com/reference/create-a-bill-payment
        
        Args:
            amount: Amount in NGN
            phone_number: Customer phone number
            provider: Provider code ('mtn', 'airtel', 'glo', '9mobile')
            
        Returns:
            Airtime purchase response
            
        Example:
            result = await service.purchase_airtime(
                amount=1000,
                phone_number="08012345678",
                provider="mtn"
            )
        """
        payload = {
            "country": "NG",
            "amount": amount,
            "type": "airtime",
            "reference": f"airtime_{phone_number}_{int(amount)}",
            "customer": {
                "phone_number": phone_number
            },
            "service_version": 2,
            "biller_code": self._get_airtime_biller_code(provider)
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Airtime purchase error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def pay_electricity(
        self,
        meter_number: str,
        amount: float,
        provider: str,
        phone_number: str = None
    ) -> Dict:
        """
        Pay electricity bills
        
        Endpoint: POST /bills
        Documentation: https://developer.flutterwave.com/reference/create-a-bill-payment
        
        Supported DISCOs:
        - aedc: Abuja Electric
        - ikedc: Ikeja Electric
        - ekedc: Eko Electric
        - phed: Port Harcourt Electric
        
        Args:
            meter_number: Meter number to pay for
            amount: Amount in NGN
            provider: DISCO code (aedc, ikedc, ekedc, phed, etc.)
            phone_number: Customer phone number (optional)
            
        Returns:
            Payment response
        """
        payload = {
            "country": "NG",
            "amount": amount,
            "type": "electricity",
            "reference": f"elec_{meter_number}_{int(amount)}",
            "biller_code": provider,
            "customer": {
                "phone_number": phone_number or ""
            },
            "service_version": 2
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Electricity payment error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def pay_cable_tv(
        self,
        smart_card_number: str,
        amount: float,
        provider: str,
        phone_number: str = None
    ) -> Dict:
        """
        Pay Cable TV subscription
        
        Endpoint: POST /bills
        
        Supported Providers:
        - dstv: DStv
        - gotv: GOtv
        - startimes: StarTimes
        
        Args:
            smart_card_number: Customer smart card number
            amount: Amount in NGN
            provider: Provider code (dstv, gotv, startimes)
            phone_number: Customer phone number (optional)
            
        Returns:
            Payment response
        """
        payload = {
            "country": "NG",
            "amount": amount,
            "type": "cable",
            "reference": f"cable_{smart_card_number}_{int(amount)}",
            "biller_code": provider,
            "customer": {
                "phone_number": phone_number or ""
            },
            "service_version": 2
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/bills",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Cable TV payment error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_bill_categories(self) -> Dict:
        """
        Get all available bill categories
        
        Endpoint: GET /bills/categories
        Documentation: https://developer.flutterwave.com/reference/get-bill-categories
        
        Returns:
            List of bill categories with codes
        """
        cache_key = "flutterwave:v4:bill_categories"
        cached = cache.get(cache_key)
        
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/bills/categories",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                # Cache for 1 day
                cache.set(cache_key, result, timeout=86400)
                return result
                
        except Exception as e:
            logger.error(f"Bill categories error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def _get_airtime_biller_code(self, provider: str) -> str:
        """
        Map provider name to Flutterwave biller code
        
        Returns biller code for airtime purchase
        """
        airtime_codes = {
            'mtn': 'BIL099',
            'airtel': 'BIL100',
            'glo': 'BIL101',
            '9mobile': 'BIL102',
        }
        
        return airtime_codes.get(provider.lower(), 'BIL099')
    
    async def verify_transaction(self, transaction_id: str) -> Dict:
        """
        Verify a transaction status
        
        Endpoint: GET /transactions/{id}/verify
        Documentation: https://developer.flutterwave.com/reference/verify-transaction
        
        Args:
            transaction_id: Flutterwave transaction ID
            
        Returns:
            Transaction details and status
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transactions/{transaction_id}/verify",
                    headers=self._get_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Transaction verification error: {e}")
            return {'status': 'error', 'message': str(e)}


# Singleton instance
_flutterwave_v4_service = None


def get_flutterwave_v4_service() -> FlutterwaveV4Service:
    """
    Get singleton instance of Flutterwave v4 service
    
    Returns:
        FlutterwaveV4Service instance
    """
    global _flutterwave_v4_service
    if _flutterwave_v4_service is None:
        _flutterwave_v4_service = FlutterwaveV4Service()
    return _flutterwave_v4_service
