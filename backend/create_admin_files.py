#!/usr/bin/env python3
"""Script to create admin.py files for all apps"""

admin_templates = {
    'wallets': """\"\"\"
Wallets Admin Configuration
\"\"\"
from django.contrib import admin
from .models import Wallet, WalletBalance, WalletActivity

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'short_address', 'network', 'is_primary', 'is_smart_account_deployed', 'created_at']
    list_filter = ['network', 'chain_id', 'is_primary', 'is_smart_account_deployed', 'is_active']
    search_fields = ['user__email', 'eoa_address', 'smart_account_address']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']

@admin.register(WalletBalance)
class WalletBalanceAdmin(admin.ModelAdmin):
    list_display = ['wallet', 'token_symbol', 'balance', 'balance_usd', 'last_updated', 'is_stale']
    list_filter = ['token_symbol', 'is_stale']
    search_fields = ['wallet__eoa_address', 'token_symbol']
    readonly_fields = ['id']

@admin.register(WalletActivity)
class WalletActivityAdmin(admin.ModelAdmin):
    list_display = ['wallet', 'activity_type', 'created_at', 'ip_address']
    list_filter = ['activity_type', 'created_at']
    search_fields = ['wallet__eoa_address', 'description']
    readonly_fields = ['id', 'created_at']
""",
    
    'transactions': """\"\"\"
Transactions Admin Configuration
\"\"\"
from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['short_hash', 'user', 'tx_type', 'amount', 'token_symbol', 'status', 'network', 'gas_sponsored', 'created_at']
    list_filter = ['tx_type', 'status', 'network', 'gas_sponsored', 'created_at']
    search_fields = ['tx_hash', 'user__email', 'from_address', 'to_address']
    readonly_fields = ['id', 'created_at', 'updated_at', 'confirmed_at']
    ordering = ['-created_at']
    
    def short_hash(self, obj):
        return obj.short_hash
    short_hash.short_description = 'TX Hash'
""",
    
    'payments': """\"\"\"
Payments Admin Configuration
\"\"\"
from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'payment_type', 'provider', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['payment_type', 'status', 'provider', 'created_at']
    search_fields = ['reference', 'provider_reference', 'user__email', 'recipient_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']
    ordering = ['-created_at']
""",
    
    'kyc': """\"\"\"
KYC Admin Configuration
\"\"\"
from django.contrib import admin
from .models import KYCVerification

@admin.register(KYCVerification)
class KYCVerificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'tier', 'status', 'full_name', 'id_type', 'risk_score', 'submitted_at', 'reviewer']
    list_filter = ['tier', 'status', 'id_type', 'bvn_verified', 'submitted_at']
    search_fields = ['user__email', 'full_name', 'id_number', 'bvn']
    readonly_fields = ['id', 'submitted_at', 'reviewed_at', 'approved_at']
    ordering = ['-submitted_at']
    
    fieldsets = (
        ('User', {'fields': ('user', 'tier', 'status')}),
        ('Personal Information', {'fields': ('full_name', 'date_of_birth', 'nationality', 'address', 'city', 'state', 'postal_code', 'country')}),
        ('Identification', {'fields': ('id_type', 'id_number', 'bvn', 'bvn_verified')}),
        ('Documents', {'fields': ('documents', 'selfie_url')}),
        ('Verification Scores', {'fields': ('liveness_score', 'face_match_score', 'risk_score')}),
        ('Review', {'fields': ('reviewer', 'review_notes', 'rejection_reason')}),
        ('Timestamps', {'fields': ('submitted_at', 'reviewed_at', 'approved_at', 'expires_at')}),
    )
""",
    
    'gas_sponsorship': """\"\"\"
Gas Sponsorship Admin Configuration
\"\"\"
from django.contrib import admin
from .models import GasSponsorship, GasSponsorshipHistory

@admin.register(GasSponsorship)
class GasSponsorshipAdmin(admin.ModelAdmin):
    list_display = ['user', 'chain_id', 'daily_limit', 'used_today', 'kyc_multiplier', 'is_active', 'last_reset_date']
    list_filter = ['chain_id', 'is_active', 'is_verified', 'last_reset_date']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at', 'updated_at', 'total_gas_sponsored', 'transactions_sponsored']
    ordering = ['-created_at']

@admin.register(GasSponsorshipHistory)
class GasSponsorshipHistoryAdmin(admin.ModelAdmin):
    list_display = ['sponsorship', 'gas_amount', 'gas_price', 'gas_cost_native', 'gas_cost_usd', 'created_at']
    list_filter = ['created_at']
    search_fields = ['sponsorship__user__email', 'transaction__tx_hash']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']
""",
    
    'notifications': """\"\"\"
Notifications Admin Configuration
\"\"\"
from django.contrib import admin
from .models import Notification, PushToken, NotificationPreference

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['user__email', 'title', 'message']
    readonly_fields = ['id', 'created_at', 'read_at']
    ordering = ['-created_at']

@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_type', 'device_name', 'is_active', 'last_used_at']
    list_filter = ['device_type', 'is_active', 'created_at']
    search_fields = ['user__email', 'token', 'device_name']
    readonly_fields = ['id', 'created_at', 'last_used_at']

@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'push_enabled', 'email_enabled', 'sms_enabled', 'marketing_notifications', 'dnd_enabled']
    list_filter = ['push_enabled', 'email_enabled', 'sms_enabled', 'dnd_enabled']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at', 'updated_at']
"""
}

import os

# Write admin files
for app, content in admin_templates.items():
    filepath = f'apps/{app}/admin.py'
    print(f"Writing {filepath}...")
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"✓ Created {filepath}")

print("\n✅ All admin files created successfully!")
