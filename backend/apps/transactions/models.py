"""
Transaction Models - Blockchain transaction tracking
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from decimal import Decimal


class Transaction(models.Model):
    """
    Blockchain transaction tracking
    """
    
    class TransactionType(models.TextChoices):
        SEND = 'send', _('Send')
        RECEIVE = 'receive', _('Receive')
        SWAP = 'swap', _('Swap')
        PAYMENT = 'payment', _('Payment')
        GAS_REFUND = 'gas_refund', _('Gas Refund')
        SMART_ACCOUNT_DEPLOY = 'smart_account_deploy', _('Smart Account Deploy')
        OTHER = 'other', _('Other')
    
    class TransactionStatus(models.TextChoices):
        PENDING = 'pending', _('Pending')
        CONFIRMED = 'confirmed', _('Confirmed')
        FAILED = 'failed', _('Failed')
        CANCELLED = 'cancelled', _('Cancelled')
        REPLACED = 'replaced', _('Replaced')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name=_('user')
    )
    wallet = models.ForeignKey(
        'wallets.Wallet',
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name=_('wallet')
    )
    
    # Transaction details
    tx_hash = models.CharField(
        _('transaction hash'),
        max_length=66,
        unique=True,
        db_index=True,
        help_text=_('Blockchain transaction hash')
    )
    tx_type = models.CharField(
        _('transaction type'),
        max_length=30,
        choices=TransactionType.choices,
        db_index=True
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=TransactionStatus.choices,
        default=TransactionStatus.PENDING,
        db_index=True
    )
    
    # Addresses
    from_address = models.CharField(_('from address'), max_length=42, db_index=True)
    to_address = models.CharField(_('to address'), max_length=42, db_index=True)
    
    # Amount and token
    amount = models.DecimalField(
        _('amount'),
        max_digits=36,
        decimal_places=18,
        help_text=_('Transaction amount in token units')
    )
    token_symbol = models.CharField(_('token symbol'), max_length=20, db_index=True)
    token_address = models.CharField(
        _('token address'),
        max_length=42,
        blank=True,
        help_text=_('Token contract address (empty for native token)')
    )
    
    # USD value at time of transaction
    amount_usd = models.DecimalField(
        _('amount USD'),
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Gas information
    gas_limit = models.BigIntegerField(_('gas limit'), null=True, blank=True)
    gas_used = models.BigIntegerField(_('gas used'), null=True, blank=True)
    gas_price = models.BigIntegerField(_('gas price (wei)'), null=True, blank=True)
    gas_fee = models.DecimalField(
        _('gas fee'),
        max_digits=36,
        decimal_places=18,
        null=True,
        blank=True,
        help_text=_('Total gas fee in native token')
    )
    gas_sponsored = models.BooleanField(
        _('gas sponsored'),
        default=False,
        help_text=_('Whether gas was sponsored by paymaster')
    )
    
    # Block information
    block_number = models.BigIntegerField(_('block number'), null=True, blank=True, db_index=True)
    block_timestamp = models.DateTimeField(_('block timestamp'), null=True, blank=True)
    confirmations = models.IntegerField(_('confirmations'), default=0)
    
    # Network
    chain_id = models.IntegerField(_('chain ID'), db_index=True)
    network = models.CharField(_('network'), max_length=20)
    
    # Transaction metadata
    nonce = models.BigIntegerField(_('nonce'), null=True, blank=True)
    input_data = models.TextField(_('input data'), blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    
    # Error information
    error_message = models.TextField(_('error message'), blank=True)
    failure_reason = models.TextField(_('failure reason'), blank=True)
    
    # Related transactions
    replaced_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replaces',
        verbose_name=_('replaced by')
    )
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    confirmed_at = models.DateTimeField(_('confirmed at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('transaction')
        verbose_name_plural = _('transactions')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['tx_hash']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['tx_type', '-created_at']),
            models.Index(fields=['from_address', '-created_at']),
            models.Index(fields=['to_address', '-created_at']),
            models.Index(fields=['block_number']),
        ]
    
    def __str__(self):
        return f"{self.tx_type} - {self.amount} {self.token_symbol} - {self.status}"
    
    @property
    def short_hash(self):
        """Return shortened transaction hash"""
        return f"{self.tx_hash[:10]}...{self.tx_hash[-8:]}"
    
    @property
    def is_pending(self):
        """Check if transaction is pending"""
        return self.status == self.TransactionStatus.PENDING
    
    @property
    def is_confirmed(self):
        """Check if transaction is confirmed"""
        return self.status == self.TransactionStatus.CONFIRMED
    
    @property
    def is_failed(self):
        """Check if transaction failed"""
        return self.status == self.TransactionStatus.FAILED
    
    def get_explorer_url(self):
        """Get blockchain explorer URL"""
        explorers = {
            1: f'https://etherscan.io/tx/{self.tx_hash}',
            8453: f'https://basescan.org/tx/{self.tx_hash}',
            42161: f'https://arbiscan.io/tx/{self.tx_hash}',
            10: f'https://optimistic.etherscan.io/tx/{self.tx_hash}',
            137: f'https://polygonscan.com/tx/{self.tx_hash}',
        }
        return explorers.get(self.chain_id, f'#')
    
    def calculate_total_cost(self):
        """Calculate total cost including gas"""
        if self.gas_fee and not self.gas_sponsored:
            return self.amount + Decimal(str(self.gas_fee))
        return self.amount
