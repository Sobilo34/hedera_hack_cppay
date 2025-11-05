"""
Wallets Admin Configuration
"""
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
