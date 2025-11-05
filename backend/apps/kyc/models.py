"""
KYC Models - Know Your Customer verification
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class KYCVerification(models.Model):
    """
    KYC verification records
    """
    
    class KYCTier(models.IntegerChoices):
        BASIC = 1, _('Basic')
        ENHANCED = 2, _('Enhanced')
        PREMIUM = 3, _('Premium')
    
    class KYCStatus(models.TextChoices):
        PENDING = 'pending', _('Pending')
        IN_REVIEW = 'in_review', _('In Review')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        EXPIRED = 'expired', _('Expired')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='kyc_verifications',
        verbose_name=_('user')
    )
    
    # Verification details
    tier = models.IntegerField(
        _('KYC tier'),
        choices=KYCTier.choices,
        db_index=True
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=KYCStatus.choices,
        default=KYCStatus.PENDING,
        db_index=True
    )
    
    # Personal information
    full_name = models.CharField(_('full name'), max_length=255)
    date_of_birth = models.DateField(_('date of birth'))
    nationality = models.CharField(_('nationality'), max_length=100)
    address = models.TextField(_('address'))
    city = models.CharField(_('city'), max_length=100)
    state = models.CharField(_('state/province'), max_length=100)
    postal_code = models.CharField(_('postal code'), max_length=20, blank=True)
    country = models.CharField(_('country'), max_length=100)
    
    # Identification
    id_type = models.CharField(
        _('ID type'),
        max_length=50,
        help_text=_('NIN, BVN, Passport, Driver License, etc.')
    )
    id_number = models.CharField(_('ID number'), max_length=100)
    
    # BVN (Nigeria specific)
    bvn = models.CharField(
        _('BVN'),
        max_length=11,
        blank=True,
        help_text=_('Bank Verification Number')
    )
    bvn_verified = models.BooleanField(_('BVN verified'), default=False)
    
    # Documents
    documents = models.JSONField(
        _('documents'),
        default=dict,
        help_text=_('Document URLs and metadata')
    )
    selfie_url = models.URLField(_('selfie URL'), max_length=500, blank=True)
    
    # Verification scores
    liveness_score = models.DecimalField(
        _('liveness score'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Liveness detection score (0-100)')
    )
    face_match_score = models.DecimalField(
        _('face match score'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Face matching score (0-100)')
    )
    risk_score = models.DecimalField(
        _('risk score'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Overall risk score (0-100)')
    )
    
    # Verification data from provider
    verification_data = models.JSONField(
        _('verification data'),
        default=dict,
        blank=True,
        help_text=_('Data from verification provider')
    )
    
    # Review information
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_kyc',
        verbose_name=_('reviewer')
    )
    review_notes = models.TextField(_('review notes'), blank=True)
    rejection_reason = models.TextField(_('rejection reason'), blank=True)
    
    # Timestamps
    submitted_at = models.DateTimeField(_('submitted at'), auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(_('reviewed at'), null=True, blank=True)
    approved_at = models.DateTimeField(_('approved at'), null=True, blank=True)
    expires_at = models.DateTimeField(_('expires at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('KYC verification')
        verbose_name_plural = _('KYC verifications')
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['user', '-submitted_at']),
            models.Index(fields=['tier', 'status']),
            models.Index(fields=['status', '-submitted_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - Tier {self.tier} - {self.status}"
    
    @property
    def is_approved(self):
        return self.status == self.KYCStatus.APPROVED
    
    @property
    def is_pending_review(self):
        return self.status in [self.KYCStatus.PENDING, self.KYCStatus.IN_REVIEW]
