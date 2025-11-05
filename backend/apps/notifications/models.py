"""
Notification Models - Multi-channel notifications
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Notification(models.Model):
    """
    In-app notifications
    """
    
    class NotificationType(models.TextChoices):
        TRANSACTION = 'transaction', _('Transaction')
        PAYMENT = 'payment', _('Payment')
        SECURITY = 'security', _('Security')
        KYC = 'kyc', _('KYC')
        GAS = 'gas', _('Gas Sponsorship')
        MARKETING = 'marketing', _('Marketing')
        SYSTEM = 'system', _('System')
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('user')
    )
    
    # Notification content
    title = models.CharField(_('title'), max_length=255)
    message = models.TextField(_('message'))
    notification_type = models.CharField(
        _('notification type'),
        max_length=20,
        choices=NotificationType.choices,
        db_index=True
    )
    
    # Read status
    is_read = models.BooleanField(_('is read'), default=False, db_index=True)
    read_at = models.DateTimeField(_('read at'), null=True, blank=True)
    
    # Action
    action_url = models.URLField(
        _('action URL'),
        max_length=500,
        blank=True,
        help_text=_('Deep link or URL for action')
    )
    action_text = models.CharField(
        _('action text'),
        max_length=100,
        blank=True,
        help_text=_('Text for action button')
    )
    
    # Metadata
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional data (tx_hash, payment_id, etc.)')
    )
    
    # Icon/image
    icon = models.CharField(
        _('icon'),
        max_length=50,
        blank=True,
        help_text=_('Icon name or emoji')
    )
    image_url = models.URLField(_('image URL'), max_length=500, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(_('expires at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('notification')
        verbose_name_plural = _('notifications')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read', '-created_at']),
            models.Index(fields=['notification_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.title} - {'Read' if self.is_read else 'Unread'}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            from django.utils import timezone
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class PushToken(models.Model):
    """
    Push notification tokens for devices
    """
    
    class DeviceType(models.TextChoices):
        IOS = 'ios', _('iOS')
        ANDROID = 'android', _('Android')
        WEB = 'web', _('Web')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_tokens',
        verbose_name=_('user')
    )
    
    # Token details
    token = models.CharField(
        _('push token'),
        max_length=255,
        unique=True,
        db_index=True
    )
    device_type = models.CharField(
        _('device type'),
        max_length=10,
        choices=DeviceType.choices
    )
    device_name = models.CharField(_('device name'), max_length=255, blank=True)
    
    # Status
    is_active = models.BooleanField(_('is active'), default=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    last_used_at = models.DateTimeField(_('last used at'), auto_now=True)
    
    class Meta:
        verbose_name = _('push token')
        verbose_name_plural = _('push tokens')
        ordering = ['-last_used_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['token']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.device_type} - {self.token[:20]}..."


class NotificationPreference(models.Model):
    """
    User notification preferences
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preference',
        verbose_name=_('user')
    )
    
    # Channel preferences
    push_enabled = models.BooleanField(_('push notifications'), default=True)
    email_enabled = models.BooleanField(_('email notifications'), default=True)
    sms_enabled = models.BooleanField(_('SMS notifications'), default=False)
    
    # Type preferences
    transaction_notifications = models.BooleanField(
        _('transaction notifications'),
        default=True
    )
    payment_notifications = models.BooleanField(
        _('payment notifications'),
        default=True
    )
    security_notifications = models.BooleanField(
        _('security notifications'),
        default=True
    )
    kyc_notifications = models.BooleanField(
        _('KYC notifications'),
        default=True
    )
    gas_notifications = models.BooleanField(
        _('gas notifications'),
        default=True
    )
    marketing_notifications = models.BooleanField(
        _('marketing notifications'),
        default=False
    )
    
    # Do Not Disturb
    dnd_enabled = models.BooleanField(_('Do Not Disturb'), default=False)
    dnd_start_time = models.TimeField(_('DND start time'), null=True, blank=True)
    dnd_end_time = models.TimeField(_('DND end time'), null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    
    class Meta:
        verbose_name = _('notification preference')
        verbose_name_plural = _('notification preferences')
    
    def __str__(self):
        return f"{self.user.email} - Preferences"
