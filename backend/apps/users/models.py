"""
User Models - Custom User with KYC and Web3 features
"""
import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator
import secrets


class UserManager(BaseUserManager):
    """Custom user manager for email/phone authentication"""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user"""
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom User Model with KYC and Web3 features
    """
    
    class KYCTier(models.IntegerChoices):
        UNVERIFIED = 0, _('Unverified')
        BASIC = 1, _('Basic')
        ENHANCED = 2, _('Enhanced')
        PREMIUM = 3, _('Premium')
    
    class KYCStatus(models.TextChoices):
        NOT_STARTED = 'not_started', _('Not Started')
        IN_PROGRESS = 'in_progress', _('In Progress')
        PENDING_REVIEW = 'pending_review', _('Pending Review')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        SUSPENDED = 'suspended', _('Suspended')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True, db_index=True)
    username = models.CharField(
        _('username'),
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        help_text=_('Optional. 150 characters or fewer.')
    )
    
    # Phone number with validation
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(
        _('phone number'),
        validators=[phone_regex],
        max_length=17,
        unique=True,
        db_index=True,
        null=True,
        blank=True
    )
    
    # Profile fields
    full_name = models.CharField(_('full name'), max_length=255, blank=True)
    date_of_birth = models.DateField(_('date of birth'), null=True, blank=True)
    avatar = models.URLField(_('avatar URL'), max_length=500, blank=True)
    
    # KYC fields
    kyc_tier = models.IntegerField(
        _('KYC tier'),
        choices=KYCTier.choices,
        default=KYCTier.UNVERIFIED,
        db_index=True
    )
    kyc_status = models.CharField(
        _('KYC status'),
        max_length=20,
        choices=KYCStatus.choices,
        default=KYCStatus.NOT_STARTED,
        db_index=True
    )
    kyc_verified_at = models.DateTimeField(_('KYC verified at'), null=True, blank=True)
    
    # Referral system
    referral_code = models.CharField(
        _('referral code'),
        max_length=10,
        unique=True,
        db_index=True,
        editable=False
    )
    referred_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referrals',
        verbose_name=_('referred by')
    )
    
    # Security
    email_verified = models.BooleanField(_('email verified'), default=False)
    phone_verified = models.BooleanField(_('phone verified'), default=False)
    two_factor_enabled = models.BooleanField(_('2FA enabled'), default=False)
    
    # Preferences
    preferred_currency = models.CharField(
        _('preferred currency'),
        max_length=10,
        default='NGN'
    )
    preferred_language = models.CharField(
        _('preferred language'),
        max_length=10,
        default='en'
    )
    notification_preferences = models.JSONField(
        _('notification preferences'),
        default=dict,
        blank=True
    )
    
    # Metadata
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    last_login_ip = models.GenericIPAddressField(_('last login IP'), null=True, blank=True)
    
    # Use email for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    objects = UserManager()
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['kyc_tier', 'kyc_status']),
            models.Index(fields=['referral_code']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return self.email
    
    def save(self, *args, **kwargs):
        """Generate referral code on creation"""
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()
        if not self.username:
            self.username = self.email.split('@')[0] + str(uuid.uuid4())[:8]
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_referral_code():
        """Generate unique 8-character referral code"""
        while True:
            code = secrets.token_urlsafe(6)[:8].upper()
            if not User.objects.filter(referral_code=code).exists():
                return code
    
    def get_full_name(self):
        """Return full name or email"""
        return self.full_name or self.email
    
    def get_short_name(self):
        """Return first name or email"""
        if self.full_name:
            return self.full_name.split()[0]
        return self.email.split('@')[0]
    
    @property
    def is_kyc_verified(self):
        """Check if user has any KYC verification"""
        return self.kyc_tier > 0 and self.kyc_status == self.KYCStatus.APPROVED
    
    @property
    def kyc_tier_name(self):
        """Get KYC tier name"""
        return self.KYCTier(self.kyc_tier).label
    
    def get_transaction_limits(self):
        """Get transaction limits based on KYC tier"""
        limits = {
            0: {'daily': 10_000, 'monthly': 50_000},
            1: {'daily': 100_000, 'monthly': 500_000},
            2: {'daily': 1_000_000, 'monthly': 5_000_000},
            3: {'daily': -1, 'monthly': -1},  # Unlimited
        }
        return limits.get(self.kyc_tier, limits[0])
    
    def get_gas_multiplier(self):
        """Get gas sponsorship multiplier based on KYC tier"""
        multipliers = {0: 1, 1: 1, 2: 2, 3: 3}
        return multipliers.get(self.kyc_tier, 1)


class TokenBlacklist(models.Model):
    """Blacklisted JWT tokens for logout"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='blacklisted_tokens',
        verbose_name=_('user')
    )
    token = models.TextField(_('token'), unique=True, db_index=True)
    token_type = models.CharField(
        _('token type'),
        max_length=20,
        choices=[('access', 'Access'), ('refresh', 'Refresh')],
        default='access'
    )
    blacklisted_at = models.DateTimeField(_('blacklisted at'), auto_now_add=True)
    expires_at = models.DateTimeField(_('expires at'))
    reason = models.CharField(_('reason'), max_length=100, blank=True)
    
    class Meta:
        verbose_name = _('token blacklist')
        verbose_name_plural = _('token blacklists')
        ordering = ['-blacklisted_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-blacklisted_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.token_type} - {self.blacklisted_at}"


class EmailVerificationToken(models.Model):
    """Email verification tokens"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens',
        verbose_name=_('user')
    )
    token = models.CharField(_('token'), max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    expires_at = models.DateTimeField(_('expires at'))
    is_used = models.BooleanField(_('is used'), default=False)
    used_at = models.DateTimeField(_('used at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('email verification token')
        verbose_name_plural = _('email verification tokens')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.token[:8]}..."


class PasswordResetToken(models.Model):
    """Password reset tokens"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
        verbose_name=_('user')
    )
    token = models.CharField(_('token'), max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    expires_at = models.DateTimeField(_('expires at'))
    is_used = models.BooleanField(_('is used'), default=False)
    used_at = models.DateTimeField(_('used at'), null=True, blank=True)
    ip_address = models.GenericIPAddressField(_('IP address'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('password reset token')
        verbose_name_plural = _('password reset tokens')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.token[:8]}..."
