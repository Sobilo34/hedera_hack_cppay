"""
KYC Verification Service

Orchestrates the complete KYC verification flow:
- Tier management (Basic, Enhanced, Premium)
- Document collection
- Identity verification
- Review workflow
- Status management
"""
import logging
import uuid
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.core.cache import cache
from django.conf import settings

from apps.kyc.models import KYCVerification
from apps.users.models import User
from services.kyc.smile_identity_service import SmileIdentityService
from services.kyc.document_service import DocumentService

logger = logging.getLogger(__name__)


class KYCService:
    """
    KYC Verification Service
    
    Manages the complete KYC lifecycle:
    - Tier 1 (Basic): Phone + Email verification
    - Tier 2 (Enhanced): Tier 1 + ID verification + selfie
    - Tier 3 (Premium): Tier 2 + address verification + enhanced checks
    """
    
    # KYC Tiers
    TIER_BASIC = 1
    TIER_ENHANCED = 2
    TIER_PREMIUM = 3
    
    # KYC Status
    STATUS_PENDING = 'pending'
    STATUS_IN_REVIEW = 'in_review'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_EXPIRED = 'expired'
    
    # Transaction limits by tier (in USD)
    TIER_LIMITS = {
        0: {'daily': Decimal('0'), 'monthly': Decimal('0')},
        1: {'daily': Decimal('100'), 'monthly': Decimal('1000')},
        2: {'daily': Decimal('1000'), 'monthly': Decimal('10000')},
        3: {'daily': Decimal('10000'), 'monthly': Decimal('100000')},
    }
    
    # Verification validity periods
    TIER_VALIDITY = {
        1: timedelta(days=365),  # 1 year
        2: timedelta(days=730),  # 2 years
        3: timedelta(days=1095),  # 3 years
    }
    
    # Minimum verification scores
    MIN_LIVENESS_SCORE = 0.85
    MIN_FACE_MATCH_SCORE = 0.90
    MIN_DOCUMENT_SCORE = 0.80
    
    def __init__(self):
        """Initialize KYC service"""
        self.smile_service = SmileIdentityService()
        self.document_service = DocumentService()
    
    async def start_verification(
        self,
        user_id: int,
        tier: int,
        country: str = 'NG'
    ) -> Dict:
        """
        Start KYC verification process
        
        Args:
            user_id: User ID
            tier: Target KYC tier (1-3)
            country: Country code
            
        Returns:
            Verification session details
        """
        try:
            user = await User.objects.aget(id=user_id)
        except User.DoesNotExist:
            return {'success': False, 'error': 'User not found'}
        
        # Check if user already has this tier
        if user.kyc_tier >= tier:
            return {
                'success': False,
                'error': f'User already has KYC Tier {user.kyc_tier}'
            }
        
        # Check for pending verification
        existing = await KYCVerification.objects.filter(
            user=user,
            tier=tier,
            status__in=[self.STATUS_PENDING, self.STATUS_IN_REVIEW]
        ).afirst()
        
        if existing:
            return {
                'success': False,
                'error': 'Verification already in progress',
                'verification_id': existing.id
            }
        
        # Create new verification record
        verification = await KYCVerification.objects.acreate(
            user=user,
            tier=tier,
            status=self.STATUS_PENDING,
            country=country,
            expires_at=datetime.now() + self.TIER_VALIDITY[tier]
        )
        
        # Generate job ID for Smile Identity
        job_id = f"kyc_{user_id}_{verification.id}_{uuid.uuid4().hex[:8]}"
        
        return {
            'success': True,
            'verification_id': verification.id,
            'job_id': job_id,
            'tier': tier,
            'required_documents': self._get_required_documents(tier),
            'requirements': self._get_tier_requirements(tier),
        }
    
    def _get_required_documents(self, tier: int) -> List[str]:
        """Get required documents for tier"""
        documents = {
            1: ['selfie'],
            2: ['selfie', 'national_id'],
            3: ['selfie', 'national_id', 'utility_bill'],
        }
        return documents.get(tier, [])
    
    def _get_tier_requirements(self, tier: int) -> Dict:
        """Get requirements for tier"""
        requirements = {
            1: {
                'phone_verified': True,
                'email_verified': True,
                'selfie': True,
            },
            2: {
                'phone_verified': True,
                'email_verified': True,
                'selfie': True,
                'id_verification': True,
                'face_match': True,
                'liveness_check': True,
            },
            3: {
                'phone_verified': True,
                'email_verified': True,
                'selfie': True,
                'id_verification': True,
                'face_match': True,
                'liveness_check': True,
                'address_verification': True,
                'enhanced_checks': True,
            },
        }
        return requirements.get(tier, {})
    
    async def upload_documents(
        self,
        verification_id: int,
        documents: Dict[str, bytes],
        filenames: Dict[str, str]
    ) -> Dict:
        """
        Upload KYC documents
        
        Args:
            verification_id: Verification record ID
            documents: Dict of document_type -> file_data
            filenames: Dict of document_type -> filename
            
        Returns:
            Upload result
        """
        try:
            verification = await KYCVerification.objects.select_related('user').aget(
                id=verification_id
            )
        except KYCVerification.DoesNotExist:
            return {'success': False, 'error': 'Verification not found'}
        
        if verification.status != self.STATUS_PENDING:
            return {
                'success': False,
                'error': f'Cannot upload documents. Status: {verification.status}'
            }
        
        uploaded_docs = {}
        errors = []
        
        for doc_type, file_data in documents.items():
            filename = filenames.get(doc_type, f'{doc_type}.jpg')
            
            result = await self.document_service.upload_document(
                user_id=verification.user.id,
                document_type=doc_type,
                file_data=file_data,
                original_filename=filename,
                metadata={'verification_id': verification_id}
            )
            
            if result['success']:
                uploaded_docs[doc_type] = {
                    'url': result['file_url'],
                    'path': result['file_path'],
                    'size': result['file_size'],
                }
            else:
                errors.extend(result['errors'])
        
        if errors:
            return {
                'success': False,
                'errors': errors,
                'uploaded': uploaded_docs
            }
        
        # Update verification record
        current_docs = verification.documents or {}
        current_docs.update(uploaded_docs)
        verification.documents = current_docs
        await verification.asave()
        
        return {
            'success': True,
            'uploaded': uploaded_docs,
            'verification_id': verification_id
        }
    
    async def submit_for_verification(
        self,
        verification_id: int,
        personal_info: Dict
    ) -> Dict:
        """
        Submit KYC for verification
        
        Args:
            verification_id: Verification record ID
            personal_info: Personal information dict
                - full_name
                - date_of_birth
                - nationality
                - address (for Tier 3)
                - id_type
                - id_number
                - bvn (optional, Nigeria)
                
        Returns:
            Submission result
        """
        try:
            verification = await KYCVerification.objects.select_related('user').aget(
                id=verification_id
            )
        except KYCVerification.DoesNotExist:
            return {'success': False, 'error': 'Verification not found'}
        
        # Validate required documents
        required_docs = self._get_required_documents(verification.tier)
        missing_docs = [
            doc for doc in required_docs
            if doc not in (verification.documents or {})
        ]
        
        if missing_docs:
            return {
                'success': False,
                'error': f'Missing documents: {", ".join(missing_docs)}'
            }
        
        # Update personal info
        verification.full_name = personal_info.get('full_name')
        verification.date_of_birth = personal_info.get('date_of_birth')
        verification.nationality = personal_info.get('nationality')
        verification.id_type = personal_info.get('id_type')
        verification.id_number = personal_info.get('id_number')
        verification.bvn = personal_info.get('bvn')
        
        if verification.tier >= self.TIER_PREMIUM:
            verification.address_line1 = personal_info.get('address_line1')
            verification.address_line2 = personal_info.get('address_line2')
            verification.city = personal_info.get('city')
            verification.state = personal_info.get('state')
            verification.postal_code = personal_info.get('postal_code')
        
        # Submit to Smile Identity
        job_id = f"kyc_{verification.user.id}_{verification.id}_{uuid.uuid4().hex[:8]}"
        
        # Get selfie image
        selfie_doc = verification.documents.get('selfie', {})
        if not selfie_doc:
            return {'success': False, 'error': 'Selfie image required'}
        
        selfie_path = selfie_doc.get('path')
        selfie_data = await self.document_service.get_document(selfie_path)
        selfie_base64 = self.document_service.encode_image_base64(selfie_data)
        
        # For Tier 2 and 3, submit enhanced KYC
        if verification.tier >= self.TIER_ENHANCED:
            result = await self.smile_service.document_verification(
                user_id=str(verification.user.id),
                job_id=job_id,
                country=verification.country,
                id_type=verification.id_type or 'NIN',
                id_number=verification.id_number or '',
                selfie_image=selfie_base64
            )
        else:
            # Tier 1: Just liveness check
            result = await self.smile_service.smart_selfie_authentication(
                user_id=str(verification.user.id),
                job_id=job_id,
                selfie_image=selfie_base64,
                liveness_images=[]  # Would come from frontend
            )
        
        if result.get('status') == 'error':
            return {
                'success': False,
                'error': f'Verification submission failed: {result.get("message")}'
            }
        
        # Update status
        verification.status = self.STATUS_IN_REVIEW
        verification.submitted_at = datetime.now()
        verification.smile_job_id = job_id
        await verification.asave()
        
        return {
            'success': True,
            'verification_id': verification.id,
            'job_id': job_id,
            'status': self.STATUS_IN_REVIEW,
            'message': 'KYC submitted for review'
        }
    
    async def check_verification_status(
        self,
        verification_id: int
    ) -> Dict:
        """
        Check verification status
        
        Args:
            verification_id: Verification record ID
            
        Returns:
            Current status and details
        """
        try:
            verification = await KYCVerification.objects.select_related('user').aget(
                id=verification_id
            )
        except KYCVerification.DoesNotExist:
            return {'success': False, 'error': 'Verification not found'}
        
        result = {
            'success': True,
            'verification_id': verification.id,
            'tier': verification.tier,
            'status': verification.status,
            'submitted_at': verification.submitted_at,
            'reviewed_at': verification.reviewed_at,
        }
        
        # If in review, check Smile Identity status
        if verification.status == self.STATUS_IN_REVIEW and verification.smile_job_id:
            smile_status = await self.smile_service.get_job_status(
                user_id=str(verification.user.id),
                job_id=verification.smile_job_id
            )
            
            if smile_status.get('status') != 'error':
                result['smile_status'] = smile_status
        
        # Add rejection reason if applicable
        if verification.status == self.STATUS_REJECTED:
            result['rejection_reason'] = verification.rejection_reason
        
        # Add expiry info
        if verification.status == self.STATUS_APPROVED:
            result['expires_at'] = verification.expires_at
            result['days_until_expiry'] = (verification.expires_at - datetime.now()).days
        
        return result
    
    async def process_callback(
        self,
        callback_data: Dict
    ) -> Dict:
        """
        Process Smile Identity callback
        
        Args:
            callback_data: Callback data from Smile Identity
            
        Returns:
            Processing result
        """
        # Parse callback data
        parsed = self.smile_service.parse_callback_data(callback_data)
        
        smile_job_id = parsed.get('smile_job_id')
        if not smile_job_id:
            return {'success': False, 'error': 'Invalid callback data'}
        
        # Find verification record
        try:
            verification = await KYCVerification.objects.select_related('user').aget(
                smile_job_id=smile_job_id
            )
        except KYCVerification.DoesNotExist:
            logger.warning(f"Verification not found for job: {smile_job_id}")
            return {'success': False, 'error': 'Verification not found'}
        
        # Update scores
        verification.liveness_score = parsed.get('liveness_score')
        verification.face_match_score = parsed.get('face_match_score')
        verification.document_score = parsed.get('confidence')
        
        # Auto-approve or flag for manual review
        if parsed['success']:
            # Check scores against thresholds
            auto_approve = True
            
            if verification.liveness_score and verification.liveness_score < self.MIN_LIVENESS_SCORE:
                auto_approve = False
            
            if verification.face_match_score and verification.face_match_score < self.MIN_FACE_MATCH_SCORE:
                auto_approve = False
            
            if verification.document_score and verification.document_score < self.MIN_DOCUMENT_SCORE:
                auto_approve = False
            
            if auto_approve and verification.tier == self.TIER_BASIC:
                # Auto-approve Tier 1
                await self._approve_verification(verification)
            else:
                # Keep in review for manual approval
                verification.status = self.STATUS_IN_REVIEW
                await verification.asave()
        else:
            # Auto-reject
            verification.status = self.STATUS_REJECTED
            verification.rejection_reason = 'Verification failed. Please try again with clear documents.'
            verification.reviewed_at = datetime.now()
            await verification.asave()
        
        return {
            'success': True,
            'verification_id': verification.id,
            'status': verification.status
        }
    
    async def _approve_verification(self, verification: KYCVerification):
        """Approve verification and update user tier"""
        async with transaction.atomic():
            verification.status = self.STATUS_APPROVED
            verification.reviewed_at = datetime.now()
            verification.approved_at = datetime.now()
            await verification.asave()
            
            # Update user KYC tier
            user = verification.user
            if verification.tier > user.kyc_tier:
                user.kyc_tier = verification.tier
                user.kyc_status = 'verified'
                await user.asave()
                
                logger.info(f"User {user.id} KYC upgraded to Tier {verification.tier}")
    
    async def manual_review_approve(
        self,
        verification_id: int,
        reviewer_id: int,
        notes: Optional[str] = None
    ) -> Dict:
        """
        Manually approve verification
        
        Args:
            verification_id: Verification record ID
            reviewer_id: Admin user ID
            notes: Review notes
            
        Returns:
            Approval result
        """
        try:
            verification = await KYCVerification.objects.select_related('user').aget(
                id=verification_id
            )
        except KYCVerification.DoesNotExist:
            return {'success': False, 'error': 'Verification not found'}
        
        if verification.status == self.STATUS_APPROVED:
            return {'success': False, 'error': 'Already approved'}
        
        verification.reviewer_id = reviewer_id
        verification.review_notes = notes
        await self._approve_verification(verification)
        
        return {
            'success': True,
            'verification_id': verification.id,
            'status': self.STATUS_APPROVED
        }
    
    async def manual_review_reject(
        self,
        verification_id: int,
        reviewer_id: int,
        rejection_reason: str,
        notes: Optional[str] = None
    ) -> Dict:
        """
        Manually reject verification
        
        Args:
            verification_id: Verification record ID
            reviewer_id: Admin user ID
            rejection_reason: Reason for rejection
            notes: Review notes
            
        Returns:
            Rejection result
        """
        try:
            verification = await KYCVerification.objects.aget(id=verification_id)
        except KYCVerification.DoesNotExist:
            return {'success': False, 'error': 'Verification not found'}
        
        verification.status = self.STATUS_REJECTED
        verification.reviewer_id = reviewer_id
        verification.rejection_reason = rejection_reason
        verification.review_notes = notes
        verification.reviewed_at = datetime.now()
        await verification.asave()
        
        return {
            'success': True,
            'verification_id': verification.id,
            'status': self.STATUS_REJECTED
        }
    
    def get_transaction_limits(self, kyc_tier: int) -> Dict:
        """Get transaction limits for KYC tier"""
        return self.TIER_LIMITS.get(kyc_tier, self.TIER_LIMITS[0])
