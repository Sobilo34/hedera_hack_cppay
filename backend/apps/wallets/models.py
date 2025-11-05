"""
Wallet Models - Multi-chain wallet management
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Wallet(models.Model):
    """
    User wallet with EOA and Smart Account support
    """
    
    class WalletType(models.TextChoices):
        EOA = 'eoa', _('Externally Owned Account')
        SMART_ACCOUNT = 'smart_account', _('Smart Account (ERC-4337)')
    
    class Network(models.TextChoices):
        ETHEREUM = 'ethereum', _('Ethereum')
        BASE = 'base', _('Base')
        ARBITRUM = 'arbitrum', _('Arbitrum')
        OPTIMISM = 'optimism', _('Optimism')
        POLYGON = 'polygon', _('Polygon')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallets',
        verbose_name=_('user')
    )
    
    # Wallet addresses
    eoa_address = models.CharField(
        _('EOA address'),
        max_length=42,
        unique=True,
        db_index=True,
        help_text=_('Externally Owned Account address (0x...)')
    )
    smart_account_address = models.CharField(
        _('smart account address'),
        max_length=42,
        unique=True,
        db_index=True,
        null=True,
        blank=True,
        help_text=_('ERC-4337 Smart Account address (0x...)')
    )
    
    # Network configuration
    chain_id = models.IntegerField(
        _('chain ID'),
        db_index=True,
        help_text=_('Blockchain chain ID (1=Ethereum, 8453=Base, etc.)')
    )
    network = models.CharField(
        _('network'),
        max_length=20,
        choices=Network.choices,
        db_index=True
    )
    
    # Smart Account deployment
    is_smart_account_deployed = models.BooleanField(
        _('smart account deployed'),
        default=False,
        help_text=_('Whether the smart account contract is deployed on-chain')
    )
    deployment_tx_hash = models.CharField(
        _('deployment transaction hash'),
        max_length=66,
        blank=True,
        help_text=_('Transaction hash of smart account deployment')
    )
    
    # Wallet metadata
    wallet_name = models.CharField(
        _('wallet name'),
        max_length=100,
        blank=True,
        help_text=_('User-defined wallet name')
    )
    is_primary = models.BooleanField(
        _('is primary'),
        default=False,
        help_text=_('Primary wallet for this user on this network')
    )
    is_active = models.BooleanField(_('is active'), default=True)
    
    # Security
    is_backed_up = models.BooleanField(
        _('is backed up'),
        default=False,
        help_text=_('Whether user has backed up seed phrase/private key')
    )
    backup_reminder_sent = models.BooleanField(
        _('backup reminder sent'),
        default=False
    )
    
    # Metadata
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    last_used_at = models.DateTimeField(_('last used at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('wallet')
        verbose_name_plural = _('wallets')
        ordering = ['-is_primary', '-created_at']
        unique_together = [['user', 'chain_id', 'eoa_address']]
        indexes = [
            models.Index(fields=['user', 'chain_id']),
            models.Index(fields=['eoa_address']),
            models.Index(fields=['smart_account_address']),
            models.Index(fields=['user', 'is_primary']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        wallet_type = "Smart" if self.smart_account_address else "EOA"
        return f"{self.user.email} - {wallet_type} - {self.network} ({self.eoa_address[:10]}...)"
    
    def save(self, *args, **kwargs):
        """Ensure only one primary wallet per user per network"""
        if self.is_primary:
            Wallet.objects.filter(
                user=self.user,
                chain_id=self.chain_id,
                is_primary=True
            ).exclude(id=self.id).update(is_primary=False)
        super().save(*args, **kwargs)
    
    @property
    def display_address(self):
        """Return smart account address if available, else EOA"""
        return self.smart_account_address or self.eoa_address
    
    @property
    def short_address(self):
        """Return shortened address for display"""
        addr = self.display_address
        return f"{addr[:6]}...{addr[-4:]}"
    
    def get_chain_name(self):
        """Get human-readable chain name"""
        chain_names = {
            1: 'Ethereum',
            8453: 'Base',
            42161: 'Arbitrum',
            10: 'Optimism',
            137: 'Polygon',
        }
        return chain_names.get(self.chain_id, f'Chain {self.chain_id}')


class WalletBalance(models.Model):
    """
    Cached wallet balances for quick access
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name='balances',
        verbose_name=_('wallet')
    )
    
    # Token information
    token_symbol = models.CharField(
        _('token symbol'),
        max_length=20,
        db_index=True,
        help_text=_('Token symbol (ETH, USDC, USDT, etc.)')
    )
    token_address = models.CharField(
        _('token address'),
        max_length=42,
        blank=True,
        help_text=_('Token contract address (empty for native token)')
    )
    token_decimals = models.IntegerField(
        _('token decimals'),
        default=18
    )
    
    # Balance
    balance = models.DecimalField(
        _('balance'),
        max_digits=36,
        decimal_places=18,
        default=0,
        help_text=_('Token balance in smallest unit')
    )
    balance_usd = models.DecimalField(
        _('balance USD'),
        max_digits=20,
        decimal_places=2,
        default=0,
        help_text=_('Balance in USD equivalent')
    )
    
    # Cache metadata
    last_updated = models.DateTimeField(_('last updated'), auto_now=True, db_index=True)
    is_stale = models.BooleanField(
        _('is stale'),
        default=False,
        help_text=_('Whether balance needs refresh')
    )
    
    class Meta:
        verbose_name = _('wallet balance')
        verbose_name_plural = _('wallet balances')
        unique_together = [['wallet', 'token_symbol']]
        ordering = ['-balance_usd']
        indexes = [
            models.Index(fields=['wallet', 'token_symbol']),
            models.Index(fields=['wallet', '-balance_usd']),
            models.Index(fields=['-last_updated']),
        ]
    
    def __str__(self):
        return f"{self.wallet.short_address} - {self.balance} {self.token_symbol}"
    
    @property
    def formatted_balance(self):
        """Return human-readable balance"""
        return f"{self.balance:.4f} {self.token_symbol}"


class WalletActivity(models.Model):
    """
    Track wallet activity for analytics
    """
    
    class ActivityType(models.TextChoices):
        CREATED = 'created', _('Wallet Created')
        SMART_ACCOUNT_DEPLOYED = 'smart_account_deployed', _('Smart Account Deployed')
        TRANSACTION = 'transaction', _('Transaction')
        BALANCE_CHECK = 'balance_check', _('Balance Check')
        BACKUP = 'backup', _('Backup Performed')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name='activities',
        verbose_name=_('wallet')
    )
    
    activity_type = models.CharField(
        _('activity type'),
        max_length=30,
        choices=ActivityType.choices,
        db_index=True
    )
    description = models.TextField(_('description'), blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(_('IP address'), null=True, blank=True)
    user_agent = models.TextField(_('user agent'), blank=True)
    
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = _('wallet activity')
        verbose_name_plural = _('wallet activities')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.wallet.short_address} - {self.activity_type} - {self.created_at}"
