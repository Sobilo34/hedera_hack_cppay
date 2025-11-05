"""
Gas Sponsorship Models - Track gas sponsorship and limits
"""
import uuid
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class GasSponsorship(models.Model):
    """
    Track daily gas sponsorship limits per user per chain
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gas_sponsorships',
        verbose_name=_('user')
    )
    chain_id = models.IntegerField(_('chain ID'), db_index=True)
    
    # Daily limits (in wei or smallest gas unit)
    daily_limit = models.BigIntegerField(
        _('daily limit'),
        help_text=_('Daily gas limit in wei')
    )
    used_today = models.BigIntegerField(
        _('used today'),
        default=0,
        help_text=_('Gas used today in wei')
    )
    
    # KYC multiplier
    kyc_multiplier = models.DecimalField(
        _('KYC multiplier'),
        max_digits=4,
        decimal_places=2,
        default=1.0,
        help_text=_('Multiplier based on KYC tier')
    )
    
    # Reset tracking
    last_reset_date = models.DateField(
        _('last reset date'),
        default=timezone.now,
        db_index=True
    )
    
    # Status
    is_active = models.BooleanField(_('is active'), default=True)
    is_verified = models.BooleanField(
        _('is verified'),
        default=False,
        help_text=_('Verified on-chain with paymaster')
    )
    
    # Statistics
    total_gas_sponsored = models.BigIntegerField(
        _('total gas sponsored'),
        default=0,
        help_text=_('Total gas sponsored lifetime (wei)')
    )
    transactions_sponsored = models.IntegerField(
        _('transactions sponsored'),
        default=0
    )
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    
    class Meta:
        verbose_name = _('gas sponsorship')
        verbose_name_plural = _('gas sponsorships')
        unique_together = [['user', 'chain_id']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'chain_id']),
            models.Index(fields=['last_reset_date']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - Chain {self.chain_id} - {self.used_today}/{self.daily_limit}"
    
    def reset_if_needed(self):
        """Reset daily usage if 24 hours have passed"""
        today = timezone.now().date()
        if self.last_reset_date < today:
            self.used_today = 0
            self.last_reset_date = today
            self.save(update_fields=['used_today', 'last_reset_date', 'updated_at'])
            return True
        return False
    
    @property
    def effective_daily_limit(self):
        """Get effective daily limit with KYC multiplier"""
        return int(self.daily_limit * float(self.kyc_multiplier))
    
    @property
    def remaining_today(self):
        """Get remaining gas allowance for today"""
        return max(0, self.effective_daily_limit - self.used_today)
    
    @property
    def usage_percentage(self):
        """Get usage percentage"""
        if self.effective_daily_limit == 0:
            return 0
        return min(100, (self.used_today / self.effective_daily_limit) * 100)
    
    def can_sponsor(self, gas_amount):
        """Check if can sponsor given gas amount"""
        self.reset_if_needed()
        return self.is_active and self.remaining_today >= gas_amount
    
    def record_usage(self, gas_amount):
        """Record gas usage"""
        self.reset_if_needed()
        self.used_today += gas_amount
        self.total_gas_sponsored += gas_amount
        self.transactions_sponsored += 1
        self.save(update_fields=[
            'used_today',
            'total_gas_sponsored',
            'transactions_sponsored',
            'updated_at'
        ])


class GasSponsorshipHistory(models.Model):
    """
    Historical record of gas sponsorships
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sponsorship = models.ForeignKey(
        GasSponsorship,
        on_delete=models.CASCADE,
        related_name='history',
        verbose_name=_('sponsorship')
    )
    transaction = models.ForeignKey(
        'transactions.Transaction',
        on_delete=models.CASCADE,
        related_name='gas_sponsorship_history',
        verbose_name=_('transaction')
    )
    
    # Gas details
    gas_amount = models.BigIntegerField(
        _('gas amount'),
        help_text=_('Gas amount sponsored in wei')
    )
    gas_price = models.BigIntegerField(
        _('gas price'),
        help_text=_('Gas price at time of sponsorship (wei)')
    )
    gas_cost_native = models.DecimalField(
        _('gas cost (native token)'),
        max_digits=36,
        decimal_places=18
    )
    gas_cost_usd = models.DecimalField(
        _('gas cost (USD)'),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Timestamp
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = _('gas sponsorship history')
        verbose_name_plural = _('gas sponsorship histories')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sponsorship', '-created_at']),
            models.Index(fields=['transaction']),
        ]
    
    def __str__(self):
        return f"{self.sponsorship.user.email} - {self.gas_amount} wei - {self.created_at}"


class PaymasterBudgetSnapshot(models.Model):
    """Temporal snapshot of paymaster balance and deposit health."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chain_id = models.PositiveBigIntegerField(_('chain ID'), db_index=True)
    paymaster_address = models.CharField(_('paymaster address'), max_length=42, db_index=True)

    native_balance_wei = models.BigIntegerField(_('native balance (wei)'), default=0)
    entry_point_deposit_wei = models.BigIntegerField(_('entry point deposit (wei)'), default=0)
    estimated_daily_burn_wei = models.BigIntegerField(_('estimated 24h burn (wei)'), default=0)

    block_number = models.BigIntegerField(_('block number'), null=True, blank=True)
    observed_at = models.DateTimeField(_('observed at'), default=timezone.now, db_index=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)

    class Meta:
        verbose_name = _('paymaster budget snapshot')
        verbose_name_plural = _('paymaster budget snapshots')
        ordering = ['-observed_at']
        indexes = [
            models.Index(fields=['paymaster_address', '-observed_at']),
            models.Index(fields=['chain_id', 'observed_at']),
        ]

    def __str__(self):  # pragma: no cover - representational helper
        return f"{self.paymaster_address} @ {self.chain_id} :: {self.native_balance_wei} wei"


class PaymasterReplenishmentRequest(models.Model):
    """Operator workflow for top-up and withdrawal actions on the paymaster."""

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        EXECUTING = 'executing', _('Executing')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')
        CANCELLED = 'cancelled', _('Cancelled')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chain_id = models.PositiveBigIntegerField(_('chain ID'), db_index=True)
    paymaster_address = models.CharField(_('paymaster address'), max_length=42, db_index=True)

    amount_wei = models.BigIntegerField(_('amount (wei)'))
    direction = models.CharField(
        _('direction'),
        max_length=16,
        choices=[('deposit', _('Deposit')), ('withdraw', _('Withdraw'))],
        default='deposit',
    )
    status = models.CharField(
        _('status'),
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paymaster_replenishment_requests',
    )

    latest_error = models.TextField(_('latest error'), blank=True)
    context = models.JSONField(_('context'), default=dict, blank=True)

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    processed_at = models.DateTimeField(_('processed at'), null=True, blank=True)

    class Meta:
        verbose_name = _('paymaster replenishment request')
        verbose_name_plural = _('paymaster replenishment requests')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['paymaster_address', 'status']),
        ]

    def mark_status(self, status: str, *, error: Optional[str] = None) -> None:
        """Helper to transition status while updating bookkeeping fields."""
        self.status = status if status in self.Status.values else self.Status.FAILED
        if error:
            self.latest_error = error
        if self.status in {self.Status.COMPLETED, self.Status.FAILED, self.Status.CANCELLED}:
            self.processed_at = timezone.now()
        self.save(update_fields=['status', 'latest_error', 'processed_at', 'updated_at'])

    def __str__(self):  # pragma: no cover - representational helper
        direction = '⬆️' if self.direction == 'deposit' else '⬇️'
        return f"{direction} {self.amount_wei} wei on {self.chain_id} ({self.status})"
