"""
KYC Background Tasks

Handles:
- Verification status checking
- Expired KYC detection
- Reminder notifications
- Statistics collection
"""
import logging
from datetime import datetime, timedelta
from celery import shared_task
from django.db.models import Count, Q

logger = logging.getLogger(__name__)


@shared_task(name='kyc.check_pending_verifications')
def check_pending_verifications():
    """
    Check status of pending verifications with Smile Identity
    
    Runs every 5 minutes to poll verification status for
    pending verifications and update records.
    """
    from apps.kyc.models import KYCVerification
    from services.kyc.smile_identity_service import SmileIdentityService
    from services.kyc.kyc_service import KYCService
    
    smile_service = SmileIdentityService()
    kyc_service = KYCService()
    
    # Get verifications in review for more than 5 minutes
    five_minutes_ago = datetime.now() - timedelta(minutes=5)
    
    verifications = KYCVerification.objects.filter(
        status='in_review',
        smile_job_id__isnull=False,
        submitted_at__lte=five_minutes_ago
    ).select_related('user')[:50]
    
    checked = 0
    updated = 0
    
    for verification in verifications:
        try:
            # Check status with Smile Identity
            result = smile_service.get_job_status(
                user_id=str(verification.user.id),
                job_id=verification.smile_job_id
            )
            
            if result.get('status') != 'error':
                # Check if completed
                if result.get('JobComplete'):
                    # Parse and update
                    parsed = smile_service.parse_callback_data(result)
                    
                    verification.liveness_score = parsed.get('liveness_score')
                    verification.face_match_score = parsed.get('face_match_score')
                    verification.document_score = parsed.get('confidence')
                    
                    # Auto-approve basic tier with good scores
                    if verification.tier == KYCService.TIER_BASIC:
                        if (parsed['success'] and 
                            verification.liveness_score and verification.liveness_score >= 0.85):
                            verification.status = 'approved'
                            verification.reviewed_at = datetime.now()
                            verification.approved_at = datetime.now()
                            
                            # Update user tier
                            user = verification.user
                            if verification.tier > user.kyc_tier:
                                user.kyc_tier = verification.tier
                                user.kyc_status = 'verified'
                                user.save()
                            
                            updated += 1
                    
                    verification.save()
            
            checked += 1
            
        except Exception as e:
            logger.error(f"Error checking verification {verification.id}: {e}")
            continue
    
    logger.info(f"Checked {checked} pending verifications, updated {updated}")
    
    return {
        'checked': checked,
        'updated': updated
    }


@shared_task(name='kyc.check_expired_kyc')
def check_expired_kyc():
    """
    Check for expired KYC verifications
    
    Runs daily to mark expired verifications and downgrade user tiers.
    """
    from apps.kyc.models import KYCVerification
    from apps.users.models import User
    
    now = datetime.now()
    
    # Find expired verifications
    expired = KYCVerification.objects.filter(
        status='approved',
        expires_at__lte=now
    ).select_related('user')
    
    expired_count = 0
    users_downgraded = 0
    
    for verification in expired:
        verification.status = 'expired'
        verification.save()
        expired_count += 1
        
        # Check if user should be downgraded
        user = verification.user
        
        # Find highest valid tier
        highest_valid = KYCVerification.objects.filter(
            user=user,
            status='approved',
            expires_at__gt=now
        ).order_by('-tier').first()
        
        if highest_valid:
            new_tier = highest_valid.tier
        else:
            new_tier = 0
        
        if new_tier < user.kyc_tier:
            user.kyc_tier = new_tier
            user.kyc_status = 'expired' if new_tier == 0 else 'verified'
            user.save()
            users_downgraded += 1
            
            logger.info(f"User {user.id} downgraded from tier {verification.tier} to {new_tier}")
    
    logger.info(f"Marked {expired_count} verifications as expired, downgraded {users_downgraded} users")
    
    return {
        'expired_count': expired_count,
        'users_downgraded': users_downgraded
    }


@shared_task(name='kyc.send_expiry_reminders')
def send_expiry_reminders():
    """
    Send reminders for KYC expiring soon
    
    Runs daily to notify users with KYC expiring in 30 days.
    """
    from apps.kyc.models import KYCVerification
    from services.notification.notification_service import NotificationService
    
    now = datetime.now()
    thirty_days = now + timedelta(days=30)
    
    # Find verifications expiring in 30 days
    expiring_soon = KYCVerification.objects.filter(
        status='approved',
        expires_at__range=(now, thirty_days)
    ).select_related('user')
    
    notification_service = NotificationService()
    sent = 0
    
    for verification in expiring_soon:
        days_left = (verification.expires_at - now).days
        
        try:
            # Send notification
            notification_service.send_notification(
                user_id=verification.user.id,
                title=f"KYC Tier {verification.tier} Expiring Soon",
                message=f"Your KYC verification will expire in {days_left} days. Please renew to maintain your transaction limits.",
                notification_type='kyc_expiry',
                data={
                    'verification_id': verification.id,
                    'tier': verification.tier,
                    'expires_at': verification.expires_at.isoformat(),
                    'days_left': days_left
                }
            )
            sent += 1
            
        except Exception as e:
            logger.error(f"Error sending expiry reminder to user {verification.user.id}: {e}")
            continue
    
    logger.info(f"Sent {sent} KYC expiry reminders")
    
    return {'sent': sent}


@shared_task(name='kyc.collect_stats')
def collect_kyc_stats():
    """
    Collect KYC statistics
    
    Runs hourly to collect and cache KYC metrics.
    """
    from apps.kyc.models import KYCVerification
    from apps.users.models import User
    from django.core.cache import cache
    
    # Count by status
    status_counts = KYCVerification.objects.values('status').annotate(
        count=Count('id')
    )
    
    # Count by tier (approved only)
    tier_counts = KYCVerification.objects.filter(
        status='approved'
    ).values('tier').annotate(count=Count('id'))
    
    # Pending review count
    pending_review = KYCVerification.objects.filter(
        status='in_review'
    ).count()
    
    # Users by KYC tier
    users_by_tier = User.objects.values('kyc_tier').annotate(
        count=Count('id')
    )
    
    # Average approval time (last 100 verifications)
    recent_approved = KYCVerification.objects.filter(
        status='approved',
        submitted_at__isnull=False,
        approved_at__isnull=False
    ).order_by('-approved_at')[:100]
    
    total_time = timedelta()
    count = 0
    for v in recent_approved:
        total_time += v.approved_at - v.submitted_at
        count += 1
    
    avg_approval_time = (total_time / count).total_seconds() / 3600 if count > 0 else 0
    
    stats = {
        'by_status': {item['status']: item['count'] for item in status_counts},
        'by_tier': {item['tier']: item['count'] for item in tier_counts},
        'pending_review': pending_review,
        'users_by_tier': {item['kyc_tier']: item['count'] for item in users_by_tier},
        'avg_approval_time_hours': round(avg_approval_time, 2),
        'timestamp': datetime.now().isoformat(),
    }
    
    # Cache for 1 hour
    cache.set('kyc_stats', stats, timeout=3600)
    
    logger.info(f"Collected KYC stats: {pending_review} pending review")
    
    return stats


@shared_task(name='kyc.cleanup_old_rejections')
def cleanup_old_rejections():
    """
    Clean up old rejected verification records
    
    Runs weekly to archive rejected verifications older than 90 days.
    """
    from apps.kyc.models import KYCVerification
    
    ninety_days_ago = datetime.now() - timedelta(days=90)
    
    # Count rejections to clean
    old_rejections = KYCVerification.objects.filter(
        status='rejected',
        reviewed_at__lte=ninety_days_ago
    )
    
    count = old_rejections.count()
    
    # Archive or delete (depending on requirements)
    # For now, we'll just log the count
    # old_rejections.delete()
    
    logger.info(f"Found {count} old rejected verifications (keeping for now)")
    
    return {'found': count}


@shared_task(name='kyc.alert_pending_review')
def alert_pending_review():
    """
    Alert admins about pending reviews
    
    Sends notifications if verifications are pending review for too long.
    """
    from apps.kyc.models import KYCVerification
    from services.notification.notification_service import NotificationService
    
    # Check for verifications pending > 24 hours
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    
    old_pending = KYCVerification.objects.filter(
        status='in_review',
        submitted_at__lte=twenty_four_hours_ago
    ).count()
    
    if old_pending > 0:
        logger.warning(f"{old_pending} verifications pending review for >24 hours")
        
        # Send alert to admins
        try:
            notification_service = NotificationService()
            # Would send to admin users
            # notification_service.send_admin_alert(...)
        except Exception as e:
            logger.error(f"Error sending admin alert: {e}")
    
    return {'old_pending': old_pending}
