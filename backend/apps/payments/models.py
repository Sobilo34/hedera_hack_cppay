"""
Payment Models - Bill payments, airtime, and transfers
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Payment(models.Model):
    """
    Payment records for bills, airtime, etc.
    """
    
    class PaymentType(models.TextChoices):
        AIRTIME = 'airtime', _('Airtime')
        ELECTRICITY = 'electricity', _('Electricity')
        CABLE_TV = 'cable_tv', _('Cable TV')
        INTERNET = 'internet', _('Internet')
        WATER = 'water', _('Water')
        TRANSFER = 'transfer', _('Bank Transfer')
        OTHER = 'other', _('Other')
    
    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', _('Pending')
        PROCESSING = 'processing', _('Processing')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')
        REFUNDED = 'refunded', _('Refunded')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name=_('user')
    )
    
    # Payment details
    payment_type = models.CharField(
        _('payment type'),
        max_length=20,
        choices=PaymentType.choices,
        db_index=True
    )
    provider = models.CharField(
        _('provider'),
        max_length=100,
        help_text=_('Service provider (MTN, IKEDC, DSTV, etc.)')
    )
    recipient_id = models.CharField(
        _('recipient ID'),
        max_length=100,
        help_text=_('Phone number, meter number, smartcard number, etc.')
    )
    recipient_name = models.CharField(
        _('recipient name'),
        max_length=255,
        blank=True
    )
    
    # Amount
    amount = models.DecimalField(
        _('amount'),
        max_digits=12,
        decimal_places=2,
        help_text=_('Payment amount in NGN')
    )
    currency = models.CharField(_('currency'), max_length=3, default='NGN')
    
    # Transaction reference
    reference = models.CharField(
        _('reference'),
        max_length=100,
        unique=True,
        db_index=True,
        help_text=_('Unique payment reference')
    )
    provider_reference = models.CharField(
        _('provider reference'),
        max_length=100,
        blank=True,
        help_text=_('Reference from payment provider')
    )
    
    # Status
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True
    )
    
    # Linked blockchain transaction
    transaction = models.ForeignKey(
        'transactions.Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name=_('transaction'),
        help_text=_('Linked blockchain transaction for payment')
    )
    
    # Payment metadata
    package_name = models.CharField(
        _('package name'),
        max_length=200,
        blank=True,
        help_text=_('For cable TV, internet packages')
    )
    package_code = models.CharField(_('package code'), max_length=100, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    
    # Provider response
    provider_response = models.JSONField(
        _('provider response'),
        default=dict,
        blank=True
    )
    
    # Error information
    error_message = models.TextField(_('error message'), blank=True)
    failure_reason = models.TextField(_('failure reason'), blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    completed_at = models.DateTimeField(_('completed at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('payment')
        verbose_name_plural = _('payments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['reference']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['payment_type', '-created_at']),
            models.Index(fields=['provider', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.payment_type} - {self.amount} {self.currency} - {self.status}"
    
    @property
    def is_pending(self):
        return self.status == self.PaymentStatus.PENDING
    
    @property
    def is_completed(self):
        return self.status == self.PaymentStatus.COMPLETED
    
    @property
    def is_failed(self):
        return self.status == self.PaymentStatus.FAILED
