"""
KYC API Router

Endpoints:
- Start verification
- Upload documents
- Submit for review
- Check status
- Admin review
- Get user limits
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field

from api.dependencies import get_current_user, get_current_admin_user
from apps.users.models import User
from services.kyc.kyc_service import KYCService
from services.kyc.smile_identity_service import SmileIdentityService

router = APIRouter(prefix="/kyc", tags=["KYC"])
kyc_service = KYCService()
smile_service = SmileIdentityService()


# ============= Pydantic Schemas =============

class StartVerificationRequest(BaseModel):
    """Start KYC verification request"""
    tier: int = Field(..., ge=1, le=3, description="KYC tier (1-3)")
    country: str = Field(default="NG", description="Country code")


class StartVerificationResponse(BaseModel):
    """Start verification response"""
    success: bool
    verification_id: Optional[int] = None
    job_id: Optional[str] = None
    tier: Optional[int] = None
    required_documents: Optional[List[str]] = None
    requirements: Optional[dict] = None
    error: Optional[str] = None


class SubmitPersonalInfoRequest(BaseModel):
    """Submit personal information"""
    verification_id: int
    full_name: str
    date_of_birth: str = Field(..., description="Format: YYYY-MM-DD")
    nationality: str
    id_type: str = Field(..., description="BVN, NIN, PASSPORT, etc.")
    id_number: str
    bvn: Optional[str] = None
    # Address fields (Tier 3)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None


class SubmitVerificationResponse(BaseModel):
    """Submit verification response"""
    success: bool
    verification_id: Optional[int] = None
    job_id: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class VerificationStatusResponse(BaseModel):
    """Verification status response"""
    success: bool
    verification_id: Optional[int] = None
    tier: Optional[int] = None
    status: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    days_until_expiry: Optional[int] = None
    smile_status: Optional[dict] = None
    error: Optional[str] = None


class ReviewActionRequest(BaseModel):
    """Admin review action"""
    verification_id: int
    action: str = Field(..., description="approve or reject")
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class ReviewActionResponse(BaseModel):
    """Review action response"""
    success: bool
    verification_id: Optional[int] = None
    status: Optional[str] = None
    error: Optional[str] = None


class TransactionLimitsResponse(BaseModel):
    """Transaction limits response"""
    kyc_tier: int
    daily_limit: str
    monthly_limit: str
    current_usage: dict


class WebTokenRequest(BaseModel):
    """Web token request for hosted SDK"""
    tier: int = Field(..., ge=1, le=3)


class WebTokenResponse(BaseModel):
    """Web token response"""
    success: bool
    token: Optional[str] = None
    web_url: Optional[str] = None
    job_id: Optional[str] = None
    error: Optional[str] = None


# ============= Endpoints =============

@router.post("/start", response_model=StartVerificationResponse)
async def start_verification(
    request: StartVerificationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Start KYC verification process
    
    - **tier**: KYC tier to verify (1-3)
    - **country**: Country code (default: NG)
    
    Returns verification session with required documents
    """
    result = await kyc_service.start_verification(
        user_id=current_user.id,
        tier=request.tier,
        country=request.country
    )
    
    return StartVerificationResponse(**result)


@router.post("/upload-documents")
async def upload_documents(
    verification_id: int = Form(...),
    document_type: str = Form(..., description="selfie, national_id, utility_bill, etc."),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload KYC document
    
    - **verification_id**: Active verification session ID
    - **document_type**: Type of document (selfie, national_id, utility_bill)
    - **file**: Image file (JPG, PNG)
    
    Uploads and stores document securely
    """
    # Read file data
    file_data = await file.read()
    
    result = await kyc_service.upload_documents(
        verification_id=verification_id,
        documents={document_type: file_data},
        filenames={document_type: file.filename}
    )
    
    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('errors', ['Upload failed'])
        )
    
    return result


@router.post("/submit", response_model=SubmitVerificationResponse)
async def submit_for_verification(
    request: SubmitPersonalInfoRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Submit KYC for verification
    
    Submits all documents and personal information to Smile Identity
    for verification. Returns job ID for status tracking.
    """
    personal_info = request.model_dump()
    verification_id = personal_info.pop('verification_id')
    
    result = await kyc_service.submit_for_verification(
        verification_id=verification_id,
        personal_info=personal_info
    )
    
    return SubmitVerificationResponse(**result)


@router.get("/status/{verification_id}", response_model=VerificationStatusResponse)
async def check_verification_status(
    verification_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Check KYC verification status
    
    Returns current verification status and progress.
    Includes Smile Identity job status if available.
    """
    result = await kyc_service.check_verification_status(verification_id)
    
    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get('error', 'Verification not found')
        )
    
    return VerificationStatusResponse(**result)


@router.get("/my-status")
async def get_my_kyc_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's KYC status
    
    Returns current KYC tier and all verification attempts
    """
    from apps.kyc.models import KYCVerification
    
    verifications = await KYCVerification.objects.filter(
        user=current_user
    ).order_by('-created_at').all()
    
    return {
        'user_id': current_user.id,
        'current_tier': current_user.kyc_tier,
        'kyc_status': current_user.kyc_status,
        'verifications': [
            {
                'id': v.id,
                'tier': v.tier,
                'status': v.status,
                'submitted_at': v.submitted_at,
                'reviewed_at': v.reviewed_at,
                'expires_at': v.expires_at if v.status == 'approved' else None,
            }
            async for v in verifications
        ]
    }


@router.get("/limits", response_model=TransactionLimitsResponse)
async def get_transaction_limits(
    current_user: User = Depends(get_current_user)
):
    """
    Get transaction limits for current KYC tier
    
    Returns daily and monthly transaction limits based on KYC verification level.
    """
    limits = kyc_service.get_transaction_limits(current_user.kyc_tier)
    
    # TODO: Get actual usage from transactions
    current_usage = {
        'daily_used': '0',
        'monthly_used': '0',
    }
    
    return TransactionLimitsResponse(
        kyc_tier=current_user.kyc_tier,
        daily_limit=str(limits['daily']),
        monthly_limit=str(limits['monthly']),
        current_usage=current_usage
    )


@router.post("/web-token", response_model=WebTokenResponse)
async def get_web_token(
    request: WebTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get web token for Smile Identity hosted SDK
    
    Returns token and URL for web-based KYC verification flow.
    Users can complete KYC in a hosted web page instead of uploading manually.
    """
    # Start verification first
    verification = await kyc_service.start_verification(
        user_id=current_user.id,
        tier=request.tier
    )
    
    if not verification['success']:
        return WebTokenResponse(
            success=False,
            error=verification.get('error')
        )
    
    job_id = verification['job_id']
    
    # Get web token
    token_result = await smile_service.get_web_token(
        user_id=str(current_user.id),
        job_id=job_id
    )
    
    if token_result.get('status') == 'error':
        return WebTokenResponse(
            success=False,
            error=token_result.get('message')
        )
    
    return WebTokenResponse(
        success=True,
        token=token_result.get('token'),
        web_url=token_result.get('web_url'),
        job_id=job_id
    )


@router.post("/callback")
async def smile_identity_callback(callback_data: dict):
    """
    Webhook endpoint for Smile Identity callbacks
    
    Receives verification results from Smile Identity and updates
    KYC verification status automatically.
    """
    result = await kyc_service.process_callback(callback_data)
    
    return result


# ============= Admin Endpoints =============

@router.get("/admin/pending")
async def get_pending_verifications(
    skip: int = 0,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin_user)
):
    """
    Get pending verifications for admin review
    
    Returns list of verifications awaiting manual review.
    """
    from apps.kyc.models import KYCVerification
    
    verifications = KYCVerification.objects.filter(
        status='in_review'
    ).select_related('user').order_by('-submitted_at')[skip:skip+limit]
    
    return {
        'verifications': [
            {
                'id': v.id,
                'user_id': v.user.id,
                'user_email': v.user.email,
                'tier': v.tier,
                'status': v.status,
                'submitted_at': v.submitted_at,
                'full_name': v.full_name,
                'id_type': v.id_type,
                'id_number': v.id_number,
                'liveness_score': v.liveness_score,
                'face_match_score': v.face_match_score,
                'document_score': v.document_score,
            }
            async for v in verifications
        ]
    }


@router.get("/admin/verification/{verification_id}")
async def get_verification_details(
    verification_id: int,
    admin_user: User = Depends(get_current_admin_user)
):
    """
    Get detailed verification information for admin review
    
    Returns complete verification data including documents and scores.
    """
    from apps.kyc.models import KYCVerification
    from services.kyc.document_service import DocumentService
    
    try:
        verification = await KYCVerification.objects.select_related('user').aget(
            id=verification_id
        )
    except KYCVerification.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found"
        )
    
    doc_service = DocumentService()
    
    # Generate presigned URLs for documents
    documents = {}
    for doc_type, doc_info in (verification.documents or {}).items():
        documents[doc_type] = {
            **doc_info,
            'url': doc_service.get_presigned_url(doc_info['path'])
        }
    
    return {
        'id': verification.id,
        'user': {
            'id': verification.user.id,
            'email': verification.user.email,
            'phone_number': verification.user.phone_number,
            'current_tier': verification.user.kyc_tier,
        },
        'tier': verification.tier,
        'status': verification.status,
        'country': verification.country,
        'full_name': verification.full_name,
        'date_of_birth': verification.date_of_birth,
        'nationality': verification.nationality,
        'id_type': verification.id_type,
        'id_number': verification.id_number,
        'bvn': verification.bvn,
        'address': {
            'line1': verification.address_line1,
            'line2': verification.address_line2,
            'city': verification.city,
            'state': verification.state,
            'postal_code': verification.postal_code,
        },
        'documents': documents,
        'scores': {
            'liveness': verification.liveness_score,
            'face_match': verification.face_match_score,
            'document': verification.document_score,
        },
        'submitted_at': verification.submitted_at,
        'reviewed_at': verification.reviewed_at,
        'reviewer_id': verification.reviewer_id,
        'review_notes': verification.review_notes,
        'rejection_reason': verification.rejection_reason,
    }


@router.post("/admin/review", response_model=ReviewActionResponse)
async def review_verification(
    request: ReviewActionRequest,
    admin_user: User = Depends(get_current_admin_user)
):
    """
    Approve or reject KYC verification
    
    - **action**: "approve" or "reject"
    - **rejection_reason**: Required if rejecting
    - **notes**: Optional review notes
    """
    if request.action == 'approve':
        result = await kyc_service.manual_review_approve(
            verification_id=request.verification_id,
            reviewer_id=admin_user.id,
            notes=request.notes
        )
    elif request.action == 'reject':
        if not request.rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason required"
            )
        
        result = await kyc_service.manual_review_reject(
            verification_id=request.verification_id,
            reviewer_id=admin_user.id,
            rejection_reason=request.rejection_reason,
            notes=request.notes
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Must be 'approve' or 'reject'"
        )
    
    return ReviewActionResponse(**result)


@router.get("/admin/stats")
async def get_kyc_stats(
    admin_user: User = Depends(get_current_admin_user)
):
    """
    Get KYC verification statistics
    
    Returns counts by tier, status, and trends.
    """
    from apps.kyc.models import KYCVerification
    from django.db.models import Count
    
    # Stats by status
    status_stats = await KYCVerification.objects.values('status').annotate(
        count=Count('id')
    ).all()
    
    # Stats by tier
    tier_stats = await KYCVerification.objects.filter(
        status='approved'
    ).values('tier').annotate(count=Count('id')).all()
    
    # Pending review count
    pending_count = await KYCVerification.objects.filter(
        status='in_review'
    ).acount()
    
    return {
        'by_status': {item['status']: item['count'] async for item in status_stats},
        'by_tier': {item['tier']: item['count'] async for item in tier_stats},
        'pending_review': pending_count,
    }
