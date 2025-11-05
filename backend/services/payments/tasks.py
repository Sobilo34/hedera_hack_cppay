"""
Payment Processing Celery Tasks

Background tasks for:
- Payment status monitoring
- Price cache updates
- Payment reconciliation
- Failed payment retries
"""
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from apps.payments.models import Payment
from services.payments import (
    PriceOracleService,
    PaystackService,
    CryptoToFiatBridge
)

logger = logging.getLogger(__name__)

price_oracle = PriceOracleService()
paystack = PaystackService()
crypto_fiat_bridge = CryptoToFiatBridge()


@shared_task(name='payments.update_token_prices')
def update_token_prices():
    """
    Update cached token prices every 30 seconds
    
    Updates prices for:
    - ETH, USDC, USDT, DAI (volatile + stablecoins)
    - Multiple currencies: USD, NGN, EUR, GBP
    """
    tokens = ['ETH', 'USDC', 'USDT', 'DAI', 'MATIC', 'ARB', 'OP']
    currencies = ['usd', 'ngn']
    
    updated_count = 0
    failed_count = 0
    
    for currency in currencies:
        try:
            # Fetch all prices in one batch request
            import asyncio
            loop = asyncio.get_event_loop()
            prices = loop.run_until_complete(
                price_oracle.get_multiple_prices(tokens, currency)
            )
            
            for token, price in prices.items():
                if price:
                    cache_key = f"price:{token}:{currency}"
                    ttl = 30 if token == 'ETH' else 300  # 30s for ETH, 5m for others
                    cache.set(cache_key, float(price), ttl)
                    updated_count += 1
                else:
                    failed_count += 1
                    
        except Exception as e:
            logger.error(f"Failed to update prices for {currency}: {e}")
            failed_count += len(tokens)
    
    logger.info(f"Price update complete: {updated_count} updated, {failed_count} failed")
    return {'updated': updated_count, 'failed': failed_count}


@shared_task(name='payments.update_ngn_rate')
def update_ngn_exchange_rate():
    """
    Update USD/NGN exchange rate every 5 minutes
    """
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        rate = loop.run_until_complete(price_oracle.get_ngn_rate())
        
        if rate:
            cache.set("fiat:usd_ngn_rate", float(rate), 300)  # 5 minutes
            logger.info(f"Updated NGN rate: 1 USD = {rate} NGN")
            return {'status': 'success', 'rate': float(rate)}
        else:
            logger.error("Failed to fetch NGN exchange rate")
            return {'status': 'error', 'message': 'Rate unavailable'}
            
    except Exception as e:
        logger.error(f"Error updating NGN rate: {e}")
        return {'status': 'error', 'message': str(e)}


@shared_task(name='payments.monitor_pending_payments')
def monitor_pending_payments():
    """
    Monitor pending payments and update their status
    
    Checks Paystack for payment completion every 2 minutes
    """
    # Get all pending payments from last 24 hours
    cutoff_time = timezone.now() - timedelta(hours=24)
    pending_payments = Payment.objects.filter(
        status='pending',
        created_at__gte=cutoff_time
    ).select_related('user')
    
    updated_count = 0
    failed_count = 0
    
    for payment in pending_payments:
        try:
            metadata = dict(payment.metadata or {})
            paystack_response = metadata.get('paystack_response', {})
            reference = (
                paystack_response.get('data', {}).get('reference')
                or paystack_response.get('data', {}).get('transfer_code')
                or payment.provider_reference
                or payment.reference
            )

            if not reference:
                continue

            import asyncio
            loop = asyncio.get_event_loop()

            if payment.payment_type == 'transfer':
                result = loop.run_until_complete(paystack.verify_transfer(reference))
            else:
                result = loop.run_until_complete(paystack.check_biller_status(reference))

            if result.get('status') != 'success':
                logger.debug(
                    "Paystack verification pending for %s: %s",
                    payment.reference,
                    result.get('message')
                )
                continue

            data = result.get('data') or {}
            status_val = (data.get('status') or '').lower()
            if not status_val:
                status_val = (data.get('message') or '').lower()

            success_states = {'success', 'successful', 'completed', 'paid'}
            failure_states = {'failed', 'cancelled', 'reversed', 'declined', 'error'}

            metadata['paystack_verification'] = result

            if status_val in success_states:
                payment.status = 'completed'
                payment.completed_at = timezone.now()
                payment.provider_reference = (
                    data.get('reference')
                    or data.get('transfer_code')
                    or payment.provider_reference
                    or reference
                )
                payment.metadata = metadata
                payment.save()
                updated_count += 1
                logger.info("Payment %s marked as completed", payment.reference)

            elif status_val in failure_states:
                payment.status = 'failed'
                payment.metadata = metadata
                payment.save()
                failed_count += 1
                logger.warning("Payment %s marked as failed", payment.reference)

        except Exception as e:
            logger.error(f"Error checking payment {payment.reference}: {e}")
    
    logger.info(f"Payment monitoring complete: {updated_count} completed, {failed_count} failed")
    return {'completed': updated_count, 'failed': failed_count}


@shared_task(name='payments.retry_failed_payments')
def retry_failed_payments():
    """
    Retry failed payments that can be retried
    
    Runs every hour for payments failed in last 24 hours
    """
    cutoff_time = timezone.now() - timedelta(hours=24)
    failed_payments = Payment.objects.filter(
        status='failed',
        created_at__gte=cutoff_time,
        retry_count__lt=3  # Max 3 retries
    ).select_related('user')
    
    retried_count = 0
    
    for payment in failed_payments:
        try:
            # Check if payment type supports retry
            if payment.payment_type not in ['airtime', 'electricity', 'cable_tv']:
                continue
            
            # Increment retry count
            payment.retry_count += 1
            payment.save()
            
            # Create new reference for retry
            new_reference = f"{payment.reference}-RETRY{payment.retry_count}"
            
            # Extract payment details from metadata
            metadata = payment.metadata or {}
            stored_details = metadata.get('payment_details') or {}
            payment_details = {
                'phone_number': stored_details.get('phone_number') or metadata.get('phone_number'),
                'meter_number': stored_details.get('meter_number') or metadata.get('meter_number'),
                'smartcard_number': stored_details.get('smartcard_number') or metadata.get('smartcard_number'),
                'provider': stored_details.get('provider') or metadata.get('provider'),
                'meter_type': stored_details.get('meter_type') or metadata.get('meter_type'),
                'bouquet_code': stored_details.get('bouquet_code') or metadata.get('bouquet_code'),
                'user_address': stored_details.get('user_address') or metadata.get('user_address'),
                'recipient_id': stored_details.get('recipient_id') or metadata.get('recipient_id'),
                'account_number': stored_details.get('account_number') or metadata.get('account_number'),
                'bank_code': stored_details.get('bank_code') or metadata.get('bank_code'),
                'narration': stored_details.get('narration') or metadata.get('narration'),
                'beneficiary_name': stored_details.get('beneficiary_name') or metadata.get('beneficiary_name'),
            }
            
            # Remove None values
            payment_details = {k: v for k, v in payment_details.items() if v is not None}
            
            # Retry payment
            import asyncio
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(
                crypto_fiat_bridge.execute_crypto_to_fiat_payment(
                    user=payment.user,
                    payment_type=payment.payment_type,
                    fiat_amount=payment.amount,
                    crypto_token=metadata.get('crypto_token', 'USDC'),
                    crypto_amount=Decimal(metadata.get('crypto_amount', '0')),
                    chain=metadata.get('chain', 'base'),
                    payment_details=payment_details,
                    reference=new_reference
                )
            )
            
            if result.get('status') == 'success':
                # Update original payment record
                payment.status = 'completed'
                payment.completed_at = timezone.now()
                payment.metadata['retry_result'] = result
                payment.save()
                retried_count += 1
                logger.info(f"Payment {payment.reference} successfully retried")
                
        except Exception as e:
            logger.error(f"Failed to retry payment {payment.reference}: {e}")
    
    logger.info(f"Payment retry complete: {retried_count} successful retries")
    return {'retried': retried_count}


@shared_task(name='payments.reconcile_daily_payments')
def reconcile_daily_payments():
    """
    Daily reconciliation of payments
    
    Runs at midnight to:
    - Calculate daily payment volumes
    - Detect anomalies
    - Generate reports
    """
    yesterday = timezone.now().date() - timedelta(days=1)
    start_time = timezone.make_aware(datetime.combine(yesterday, datetime.min.time()))
    end_time = timezone.make_aware(datetime.combine(yesterday, datetime.max.time()))
    
    # Get payments for yesterday
    payments = Payment.objects.filter(
        created_at__gte=start_time,
        created_at__lte=end_time
    )
    
    # Calculate statistics
    total_payments = payments.count()
    completed_payments = payments.filter(status='completed').count()
    failed_payments = payments.filter(status='failed').count()
    pending_payments = payments.filter(status='pending').count()
    
    total_volume = sum(p.amount for p in payments if p.amount)
    completed_volume = sum(p.amount for p in payments.filter(status='completed') if p.amount)
    
    # Payment type breakdown
    payment_types = {}
    for payment_type in ['airtime', 'electricity', 'cable_tv', 'transfer']:
        count = payments.filter(payment_type=payment_type).count()
        payment_types[payment_type] = count
    
    stats = {
        'date': str(yesterday),
        'total_payments': total_payments,
        'completed': completed_payments,
        'failed': failed_payments,
        'pending': pending_payments,
        'total_volume_ngn': float(total_volume),
        'completed_volume_ngn': float(completed_volume),
        'payment_types': payment_types,
        'success_rate': (completed_payments / total_payments * 100) if total_payments > 0 else 0,
    }
    
    # Cache stats for 7 days
    cache_key = f"payment_stats:{yesterday}"
    cache.set(cache_key, stats, 604800)  # 7 days
    
    logger.info(f"Daily reconciliation complete for {yesterday}: {total_payments} payments, {completed_payments} completed")
    return stats


@shared_task(name='payments.cleanup_old_payment_cache')
def cleanup_old_payment_cache():
    """
    Cleanup old cached payment data
    
    Runs weekly to free up Redis memory
    """
    # This is a placeholder - Redis automatically expires keys with TTL
    # Additional cleanup logic can be added here if needed
    logger.info("Payment cache cleanup executed")
    return {'status': 'success'}
