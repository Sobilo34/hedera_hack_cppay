"""
Payments Admin Configuration
"""
from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'payment_type', 'provider', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['payment_type', 'status', 'provider', 'created_at']
    search_fields = ['reference', 'provider_reference', 'user__email', 'recipient_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']
    ordering = ['-created_at']
