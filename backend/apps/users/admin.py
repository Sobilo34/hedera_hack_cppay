"""
Users Admin Configuration
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, TokenBlacklist, EmailVerificationToken, PasswordResetToken


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User Admin"""
    
    list_display = [
        'email', 'full_name', 'phone', 'kyc_tier', 'kyc_status',
        'email_verified', 'phone_verified', 'is_active', 'created_at'
    ]
    list_filter = [
        'kyc_tier', 'kyc_status', 'email_verified', 'phone_verified',
        'is_active', 'is_staff', 'created_at'
    ]
    search_fields = ['email', 'full_name', 'phone', 'referral_code']
    ordering = ['-created_at']
    readonly_fields = ['id', 'referral_code', 'created_at', 'updated_at', 'last_login']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'email', 'username', 'password')
        }),
        (_('Personal Info'), {
            'fields': ('full_name', 'phone', 'date_of_birth', 'avatar')
        }),
        (_('KYC Information'), {
            'fields': ('kyc_tier', 'kyc_status', 'kyc_verified_at')
        }),
        (_('Referral'), {
            'fields': ('referral_code', 'referred_by')
        }),
        (_('Security'), {
            'fields': ('email_verified', 'phone_verified', 'two_factor_enabled')
        }),
        (_('Preferences'), {
            'fields': ('preferred_currency', 'preferred_language', 'notification_preferences')
        }),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        (_('Important dates'), {
            'fields': ('last_login', 'last_login_ip', 'created_at', 'updated_at')
        }),
        (_('Metadata'), {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'full_name', 'phone'),
        }),
    )


@admin.register(TokenBlacklist)
class TokenBlacklistAdmin(admin.ModelAdmin):
    """Token Blacklist Admin"""
    
    list_display = ['user', 'token_type', 'blacklisted_at', 'expires_at', 'reason']
    list_filter = ['token_type', 'blacklisted_at']
    search_fields = ['user__email', 'reason']
    readonly_fields = ['id', 'user', 'token', 'token_type', 'blacklisted_at']
    ordering = ['-blacklisted_at']
    
    def has_add_permission(self, request):
        return False


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    """Email Verification Token Admin"""
    
    list_display = ['user', 'token_preview', 'created_at', 'expires_at', 'is_used', 'used_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__email', 'token']
    readonly_fields = ['id', 'user', 'token', 'created_at', 'used_at']
    ordering = ['-created_at']
    
    def token_preview(self, obj):
        return f"{obj.token[:16]}..."
    token_preview.short_description = 'Token'
    
    def has_add_permission(self, request):
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """Password Reset Token Admin"""
    
    list_display = ['user', 'token_preview', 'created_at', 'expires_at', 'is_used', 'ip_address']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__email', 'token', 'ip_address']
    readonly_fields = ['id', 'user', 'token', 'created_at', 'used_at', 'ip_address']
    ordering = ['-created_at']
    
    def token_preview(self, obj):
        return f"{obj.token[:16]}..."
    token_preview.short_description = 'Token'
    
    def has_add_permission(self, request):
        return False
