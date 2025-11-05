"""
Payments App Configuration
"""
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class PaymentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.payments'
    verbose_name = 'Payments'
    
    def ready(self):
        """Validate Paystack configuration on app startup"""
        try:
            from services.payments import get_paystack_service

            service = get_paystack_service()

            if not service.secret_key:
                logger.warning(
                    "⚠ Paystack secret key not configured. Set PAYSTACK_SECRET_KEY in your environment."
                )
            else:
                logger.info("✓ Paystack secret key detected; Paystack service initialised")

        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Could not initialize Paystack on startup: %s", exc)
