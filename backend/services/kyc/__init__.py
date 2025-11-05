"""
KYC Services Module

Exports:
- SmileIdentityService: Smile Identity integration
- DocumentService: Document upload and processing
- KYCService: Main KYC verification service
"""
from services.kyc.smile_identity_service import SmileIdentityService
from services.kyc.document_service import DocumentService
from services.kyc.kyc_service import KYCService

__all__ = [
    'SmileIdentityService',
    'DocumentService',
    'KYCService',
]

