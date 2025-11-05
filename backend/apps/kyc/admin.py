"""
KYC Admin Configuration
"""
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
