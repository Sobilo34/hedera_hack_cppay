"""
Smile Identity Integration Service

Handles:
- Biometric verification (liveness detection)
- Face matching
- Document verification
- Identity verification
- BVN verification (Nigeria)
"""
import os
import logging
import hashlib
import hmac
import base64
import json
from typing import Dict, Optional, List
from datetime import datetime
import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)


class SmileIdentityService:
    """
    Smile Identity integration for KYC verification
    
    Features:
    - Biometric KYC (SmartSelfie)
    - Document verification
    - Enhanced KYC with ID verification
    - BVN verification (Nigeria)
    - Liveness detection
    - Face matching
    """
    
    # API endpoints
    BASE_URL = "https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test"
    SANDBOX_URL = "https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test"
    
    # Job types
    JOB_TYPE_BIOMETRIC_KYC = 1
    JOB_TYPE_SMART_SELFIE = 2
    JOB_TYPE_ENHANCED_KYC = 5
    JOB_TYPE_DOCUMENT_VERIFICATION = 6
    JOB_TYPE_BVN_VERIFICATION = 7
    
    # ID types
    ID_TYPE_BVN = "BVN"
    ID_TYPE_NIN = "NIN"
    ID_TYPE_VOTER_ID = "VOTER_ID"
    ID_TYPE_DRIVERS_LICENSE = "DRIVERS_LICENSE"
    ID_TYPE_PASSPORT = "PASSPORT"
    
    # Countries
    COUNTRY_NIGERIA = "NG"
    COUNTRY_KENYA = "KE"
    COUNTRY_SOUTH_AFRICA = "ZA"
    COUNTRY_GHANA = "GH"
    
    def __init__(self):
        """Initialize Smile Identity service"""
        self.partner_id = os.getenv('SMILE_PARTNER_ID')
        self.api_key = os.getenv('SMILE_API_KEY')
        self.callback_url = os.getenv('SMILE_CALLBACK_URL', '')
        self.is_sandbox = os.getenv('SMILE_SANDBOX', 'True').lower() == 'true'
        
        if not all([self.partner_id, self.api_key]):
            logger.warning("Smile Identity credentials not configured")
        
        self.base_url = self.SANDBOX_URL if self.is_sandbox else self.BASE_URL
    
    def _generate_signature(self, timestamp: str) -> str:
        """
        Generate HMAC signature for API authentication
        
        Args:
            timestamp: Unix timestamp as string
            
        Returns:
            Base64 encoded signature
        """
        message = f"{self.partner_id}{timestamp}"
        signature = hmac.new(
            self.api_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).digest()
        return base64.b64encode(signature).decode('utf-8')
    
    def _get_headers(self) -> Dict[str, str]:
        """Generate headers for API requests"""
        timestamp = str(int(datetime.now().timestamp()))
        signature = self._generate_signature(timestamp)
        
        return {
            'Content-Type': 'application/json',
            'SmileIdentity-Partner-Id': self.partner_id,
            'SmileIdentity-Timestamp': timestamp,
            'SmileIdentity-Signature': signature,
        }
    
    async def submit_job(
        self,
        user_id: str,
        job_id: str,
        job_type: int,
        id_info: Optional[Dict] = None,
        images: Optional[List[Dict]] = None,
        partner_params: Optional[Dict] = None
    ) -> Dict:
        """
        Submit a verification job to Smile Identity
        
        Args:
            user_id: User ID from your system
            job_id: Unique job identifier
            job_type: Type of verification job
            id_info: ID information (for enhanced KYC)
            images: List of image data (selfies, documents)
            partner_params: Additional parameters
            
        Returns:
            Job submission result
        """
        payload = {
            'partner_id': self.partner_id,
            'partner_params': partner_params or {},
            'source_sdk': 'rest_api',
            'source_sdk_version': '1.0.0',
            'timestamp': datetime.now().isoformat(),
            'user_id': user_id,
            'job_id': job_id,
            'job_type': job_type,
        }
        
        if id_info:
            payload['id_info'] = id_info
        
        if images:
            payload['images'] = images
        
        if self.callback_url:
            payload['callback_url'] = self.callback_url
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/upload",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Job submitted successfully: {job_id}")
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Smile Identity API error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def smart_selfie_authentication(
        self,
        user_id: str,
        job_id: str,
        selfie_image: str,  # Base64 encoded
        liveness_images: List[str],  # List of base64 encoded images
        id_info: Optional[Dict] = None
    ) -> Dict:
        """
        Perform SmartSelfie authentication with liveness detection
        
        Args:
            user_id: User ID
            job_id: Unique job ID
            selfie_image: Base64 encoded selfie image
            liveness_images: List of liveness images
            id_info: Optional ID information for enhanced verification
            
        Returns:
            Verification result with liveness and face match scores
        """
        images = [
            {
                'image_type_id': 2,  # Selfie
                'image': selfie_image,
            }
        ]
        
        # Add liveness images
        for idx, liveness_img in enumerate(liveness_images):
            images.append({
                'image_type_id': 7,  # Liveness image
                'image': liveness_img,
            })
        
        return await self.submit_job(
            user_id=user_id,
            job_id=job_id,
            job_type=self.JOB_TYPE_SMART_SELFIE,
            id_info=id_info,
            images=images
        )
    
    async def document_verification(
        self,
        user_id: str,
        job_id: str,
        country: str,
        id_type: str,
        id_number: str,
        selfie_image: str,
        id_card_image: Optional[str] = None
    ) -> Dict:
        """
        Verify identity document with selfie
        
        Args:
            user_id: User ID
            job_id: Unique job ID
            country: Country code (e.g., 'NG' for Nigeria)
            id_type: Type of ID (BVN, NIN, PASSPORT, etc.)
            id_number: ID number
            selfie_image: Base64 encoded selfie
            id_card_image: Optional base64 encoded ID card image
            
        Returns:
            Verification result
        """
        id_info = {
            'country': country,
            'id_type': id_type,
            'id_number': id_number,
        }
        
        images = [
            {
                'image_type_id': 2,  # Selfie
                'image': selfie_image,
            }
        ]
        
        if id_card_image:
            images.append({
                'image_type_id': 3,  # ID card
                'image': id_card_image,
            })
        
        return await self.submit_job(
            user_id=user_id,
            job_id=job_id,
            job_type=self.JOB_TYPE_ENHANCED_KYC,
            id_info=id_info,
            images=images
        )
    
    async def verify_bvn(
        self,
        user_id: str,
        job_id: str,
        bvn: str,
        first_name: str,
        last_name: str,
        date_of_birth: str,  # Format: YYYY-MM-DD
        phone_number: Optional[str] = None
    ) -> Dict:
        """
        Verify Bank Verification Number (Nigeria)
        
        Args:
            user_id: User ID
            job_id: Unique job ID
            bvn: 11-digit BVN
            first_name: First name on BVN
            last_name: Last name on BVN
            date_of_birth: Date of birth (YYYY-MM-DD)
            phone_number: Optional phone number
            
        Returns:
            BVN verification result
        """
        id_info = {
            'country': self.COUNTRY_NIGERIA,
            'id_type': self.ID_TYPE_BVN,
            'id_number': bvn,
            'first_name': first_name,
            'last_name': last_name,
            'dob': date_of_birth,
        }
        
        if phone_number:
            id_info['phone_number'] = phone_number
        
        return await self.submit_job(
            user_id=user_id,
            job_id=job_id,
            job_type=self.JOB_TYPE_BVN_VERIFICATION,
            id_info=id_info
        )
    
    async def get_job_status(
        self,
        user_id: str,
        job_id: str
    ) -> Dict:
        """
        Check status of a submitted job
        
        Args:
            user_id: User ID
            job_id: Job ID to check
            
        Returns:
            Job status and results
        """
        params = {
            'partner_id': self.partner_id,
            'user_id': user_id,
            'job_id': job_id,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/job_status",
                    params=params,
                    headers=self._get_headers(),
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Smile Identity status check error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def get_web_token(self, user_id: str, job_id: str) -> Dict:
        """
        Get web token for hosted web integration
        
        Args:
            user_id: User ID
            job_id: Job ID
            
        Returns:
            Web token for SmileIdentity hosted web SDK
        """
        payload = {
            'partner_id': self.partner_id,
            'user_id': user_id,
            'job_id': job_id,
            'product': 'authentication',
            'callback_url': self.callback_url,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/token",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Smile Identity token error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def parse_callback_data(self, callback_data: Dict) -> Dict:
        """
        Parse and extract useful information from callback data
        
        Args:
            callback_data: Raw callback data from Smile Identity
            
        Returns:
            Parsed verification results
        """
        result = {
            'success': False,
            'confidence': 0,
            'liveness_score': None,
            'face_match_score': None,
            'document_verified': False,
            'id_verified': False,
            'raw_data': callback_data,
        }
        
        # Extract result code
        result_code = callback_data.get('ResultCode', '')
        result_text = callback_data.get('ResultText', '')
        
        # Success codes
        if result_code == '1012':  # Verification successful
            result['success'] = True
            result['document_verified'] = True
            result['id_verified'] = True
        
        # Extract confidence score
        confidence = callback_data.get('ConfidenceValue')
        if confidence:
            result['confidence'] = float(confidence)
        
        # Extract SmileJobID
        result['smile_job_id'] = callback_data.get('SmileJobID')
        
        # Extract actions (liveness, face match results)
        actions = callback_data.get('Actions', {})
        
        if 'Liveness_Check' in actions:
            liveness = actions['Liveness_Check']
            result['liveness_score'] = float(liveness.get('Confidence', 0))
        
        if 'Selfie_To_ID_Card_Compare' in actions:
            face_match = actions['Selfie_To_ID_Card_Compare']
            result['face_match_score'] = float(face_match.get('Confidence', 0))
        
        # Extract ID verification data
        if 'Verify_ID_Number' in actions:
            id_verify = actions['Verify_ID_Number']
            result['id_verified'] = id_verify.get('ResultCode') == '1012'
            result['id_data'] = id_verify.get('Data', {})
        
        return result
    
    async def validate_id_number(
        self,
        country: str,
        id_type: str,
        id_number: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ) -> Dict:
        """
        Validate ID number without selfie (basic validation)
        
        Args:
            country: Country code
            id_type: Type of ID
            id_number: ID number to validate
            first_name: Optional first name for matching
            last_name: Optional last name for matching
            
        Returns:
            Validation result
        """
        payload = {
            'partner_id': self.partner_id,
            'country': country,
            'id_type': id_type,
            'id_number': id_number,
        }
        
        if first_name:
            payload['first_name'] = first_name
        if last_name:
            payload['last_name'] = last_name
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/id_verification",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"Smile Identity ID validation error: {e}")
            return {'status': 'error', 'message': str(e)}
