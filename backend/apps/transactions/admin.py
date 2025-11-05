"""
Transactions Admin Configuration
"""
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
