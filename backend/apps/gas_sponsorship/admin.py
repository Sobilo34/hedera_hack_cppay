"""
Gas Sponsorship Admin Configuration
"""
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
