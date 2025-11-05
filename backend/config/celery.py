"""
Celery configuration for CPPay project.
"""
import os
from celery import Celery
from decouple import config

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('cppay')

# Load configuration from Django settings with CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()

# Celery Beat Schedule for periodic tasks
app.conf.beat_schedule = {
    # Blockchain tasks (Phase 2)
    'monitor-pending-transactions': {
        'task': 'monitor_pending_transactions',
        'schedule': 30.0,  # Every 30 seconds
    },
    'reset-daily-gas-limits': {
        'task': 'reset_daily_gas_limits',
        'schedule': 86400.0,  # Daily at midnight
    },
    'monitor-paymaster-balances': {
        'task': 'monitor_paymaster_balances',
        'schedule': 3600.0,  # Every hour
    },
    'retry-stuck-transactions': {
        'task': 'retry_stuck_transactions',
        'schedule': 900.0,  # Every 15 minutes
    },
    'update-portfolio-values': {
        'task': 'update_portfolio_values',
        'schedule': 3600.0,  # Every hour
    },
    
    # Payment tasks (Phase 3)
    'update-token-prices': {
        'task': 'payments.update_token_prices',
        'schedule': 30.0,  # Every 30 seconds
    },
    'update-ngn-rate': {
        'task': 'payments.update_ngn_rate',
        'schedule': 300.0,  # Every 5 minutes
    },
    'monitor-pending-payments': {
        'task': 'payments.monitor_pending_payments',
        'schedule': 120.0,  # Every 2 minutes
    },
    'retry-failed-payments': {
        'task': 'payments.retry_failed_payments',
        'schedule': 3600.0,  # Every hour
    },
    'reconcile-daily-payments': {
        'task': 'payments.reconcile_daily_payments',
        'schedule': 86400.0,  # Daily at midnight
    },
    'cleanup-old-payment-cache': {
        'task': 'payments.cleanup_old_payment_cache',
        'schedule': 604800.0,  # Weekly
    },
    
    # Notification tasks
    'cleanup-old-notifications': {
        'task': 'apps.notifications.tasks.cleanup_old_notifications',
        'schedule': 86400.0,  # Daily
    },
    
    # KYC tasks (Phase 4)
    'check-pending-verifications': {
        'task': 'kyc.check_pending_verifications',
        'schedule': 300.0,  # Every 5 minutes
    },
    'check-expired-kyc': {
        'task': 'kyc.check_expired_kyc',
        'schedule': 86400.0,  # Daily
    },
    'send-expiry-reminders': {
        'task': 'kyc.send_expiry_reminders',
        'schedule': 86400.0,  # Daily
    },
    'collect-kyc-stats': {
        'task': 'kyc.collect_stats',
        'schedule': 3600.0,  # Every hour
    },
    'cleanup-old-rejections': {
        'task': 'kyc.cleanup_old_rejections',
        'schedule': 604800.0,  # Weekly
    },
    'alert-pending-review': {
        'task': 'kyc.alert_pending_review',
        'schedule': 7200.0,  # Every 2 hours
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery"""
    print(f'Request: {self.request!r}')
