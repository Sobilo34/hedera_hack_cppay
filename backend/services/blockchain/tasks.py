"""
Celery Tasks for Blockchain Operations

Background tasks for:
- Transaction monitoring
- Gas limit resets
- Paymaster balance monitoring
"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from services.blockchain import (
    Web3Service,
    PaymasterService,
    PaymasterControllerService,
    TransactionService
)
from apps.transactions.models import Transaction
from apps.gas_sponsorship.models import GasSponsorship
from apps.notifications.models import Notification


logger = logging.getLogger(__name__)


@shared_task(name='monitor_pending_transactions')
def monitor_pending_transactions():
    """
    Monitor all pending transactions and update their status
    Runs every 30 seconds
    """
    try:
        logger.info("👀 Monitoring pending transactions...")
        
        # Get all pending transactions
        pending_txs = Transaction.objects.filter(
            status__in=[
                Transaction.TransactionStatus.PENDING,
                Transaction.TransactionStatus.PROCESSING
            ]
        )
        
        updated_count = 0
        
        for tx in pending_txs:
            try:
                # Check if transaction is too old (>1 hour)
                if tx.created_at < timezone.now() - timedelta(hours=1):
                    logger.warning(f"⏱️ Transaction {tx.id} is stuck (>1 hour)")
                    continue
                
                # Initialize services for the chain
                web3_service = Web3Service(tx.chain_id)
                
                # Check if we have a tx_hash
                if tx.tx_hash:
                    receipt = web3_service.get_transaction_receipt(tx.tx_hash)
                    
                    if receipt:
                        status = receipt.get('status')
                        if status == 1:
                            tx.status = Transaction.TransactionStatus.CONFIRMED
                            tx.confirmed_at = timezone.now()
                            tx.gas_used = receipt.get('gasUsed', 0)
                            
                            # Update gas usage if sponsored
                            if tx.gas_sponsored:
                                paymaster_service = PaymasterService(tx.chain_id)
                                paymaster_service.update_gas_usage(
                                    tx.from_address,
                                    tx.gas_used,
                                    tx.tx_hash
                                )
                            
                            # Create notification
                            _create_transaction_notification(tx, 'confirmed')
                            
                        elif status == 0:
                            tx.status = Transaction.TransactionStatus.FAILED
                            _create_transaction_notification(tx, 'failed')
                        
                        tx.save()
                        updated_count += 1
                
            except Exception as e:
                logger.error(f"❌ Error monitoring transaction {tx.id}: {str(e)}")
                continue
        
        logger.info(f"✅ Updated {updated_count} transactions")
        return {'updated': updated_count, 'checked': pending_txs.count()}
        
    except Exception as e:
        logger.error(f"❌ Error in monitor_pending_transactions: {str(e)}")
        return {'error': str(e)}


@shared_task(name='reset_daily_gas_limits')
def reset_daily_gas_limits():
    """
    Reset daily gas limits for all users at midnight UTC
    Runs daily at 00:00 UTC
    """
    try:
        logger.info("🔄 Resetting daily gas limits...")
        
        today = timezone.now().date()
        
        # Find all gas sponsorship records that need reset
        records_to_reset = GasSponsorship.objects.filter(
            last_reset_date__lt=today,
            used_today__gt=0
        )
        
        count = records_to_reset.count()
        
        # Reset used_today and update last_reset_date
        records_to_reset.update(
            used_today=0,
            last_reset_date=today
        )
        
        logger.info(f"✅ Reset gas limits for {count} users")
        return {'reset_count': count}
        
    except Exception as e:
        logger.error(f"❌ Error resetting gas limits: {str(e)}")
        return {'error': str(e)}


@shared_task(name='monitor_paymaster_balances')
def monitor_paymaster_balances():
    """
    Monitor paymaster balances across all chains and alert if low
    Runs every hour
    """
    try:
        logger.info("💰 Monitoring paymaster balances...")
        
        # Supported chain IDs
        chain_ids = [1, 8453, 42161, 10, 137, 1135, 4202]
        
        alerts = []
        
        for chain_id in chain_ids:
            try:
                paymaster_service = PaymasterService(chain_id)
                monitoring_data = paymaster_service.monitor_and_alert()

                paymaster_controller = PaymasterControllerService(
                    chain_id=chain_id,
                    paymaster_address=paymaster_service.paymaster_address,
                )

                native_balance = paymaster_service.w3.eth.get_balance(
                    paymaster_service.paymaster_address
                )

                paymaster_controller.record_snapshot(
                    native_balance_wei=native_balance,
                    entry_point_deposit_wei=monitoring_data.get('balance', 0),
                    estimated_daily_burn_wei=monitoring_data.get('estimated_daily_burn', 0) or 0,
                    metadata={'alerts': monitoring_data.get('alerts', [])},
                )

                ticket = paymaster_controller.auto_open_when_below(
                    floor_balance_wei=PaymasterService.LOW_BALANCE_THRESHOLD,
                    top_up_amount_wei=paymaster_service.w3.to_wei(10, 'ether'),
                )
                if ticket:
                    logger.warning(
                        "🪙 Auto-opened paymaster replenishment request %s for chain %s",
                        ticket,
                        chain_id,
                    )
                
                # Check for critical alerts
                critical_alerts = [
                    alert for alert in monitoring_data.get('alerts', [])
                    if alert.get('level') == 'critical'
                ]
                
                if critical_alerts:
                    # Send notification to admins
                    _send_admin_alert(
                        f"Critical: Paymaster Issue on Chain {chain_id}",
                        monitoring_data
                    )
                    alerts.extend(critical_alerts)
                
            except Exception as e:
                logger.error(f"❌ Error monitoring chain {chain_id}: {str(e)}")
                continue
        
        logger.info(f"✅ Monitored {len(chain_ids)} chains, found {len(alerts)} alerts")
        return {
            'chains_checked': len(chain_ids),
            'alerts': len(alerts)
        }
        
    except Exception as e:
        logger.error(f"❌ Error in monitor_paymaster_balances: {str(e)}")
        return {'error': str(e)}


@shared_task(name='retry_stuck_transactions')
def retry_stuck_transactions():
    """
    Retry transactions that are stuck for more than 10 minutes
    Runs every 15 minutes
    """
    try:
        logger.info("🔄 Checking for stuck transactions...")
        
        # Find transactions pending for >10 minutes
        stuck_threshold = timezone.now() - timedelta(minutes=10)
        
        stuck_txs = Transaction.objects.filter(
            status=Transaction.TransactionStatus.PENDING,
            created_at__lt=stuck_threshold
        )
        
        retried_count = 0
        
        for tx in stuck_txs:
            try:
                logger.info(f"⚠️ Transaction {tx.id} is stuck, attempting retry...")
                
                # Mark as failed and create new transaction
                tx.status = Transaction.TransactionStatus.FAILED
                tx.error_message = "Transaction stuck, retried"
                tx.save()
                
                # TODO: Implement actual retry logic
                # This would involve recreating the UserOperation with higher gas
                
                retried_count += 1
                
            except Exception as e:
                logger.error(f"❌ Error retrying transaction {tx.id}: {str(e)}")
                continue
        
        logger.info(f"✅ Retried {retried_count} stuck transactions")
        return {'retried': retried_count, 'checked': stuck_txs.count()}
        
    except Exception as e:
        logger.error(f"❌ Error in retry_stuck_transactions: {str(e)}")
        return {'error': str(e)}


@shared_task(name='update_portfolio_values')
def update_portfolio_values():
    """
    Update cached portfolio values for all users
    Runs every hour
    """
    try:
        logger.info("💼 Updating portfolio values...")
        
        from apps.wallets.models import Wallet
        from django.core.cache import cache
        
        # Get all active wallets
        wallets = Wallet.objects.filter(
            is_smart_account_deployed=True
        ).select_related('user')
        
        updated_count = 0
        
        for wallet in wallets:
            try:
                web3_service = Web3Service(wallet.chain_id)
                
                # Get native balance
                native_balance = web3_service.get_native_balance(
                    wallet.smart_account_address
                )
                
                # Get token balances
                tokens = ['USDC', 'USDT', 'DAI']
                token_balances = web3_service.get_token_balances(
                    wallet.smart_account_address,
                    tokens
                )
                
                # Cache the balances
                cache_key = f'portfolio:{wallet.user.id}:{wallet.chain_id}'
                cache.set(cache_key, {
                    'native': float(native_balance),
                    'tokens': {k: float(v) for k, v in token_balances.items()},
                    'updated_at': timezone.now().isoformat()
                }, 3600)  # Cache for 1 hour
                
                updated_count += 1
                
            except Exception as e:
                logger.error(f"❌ Error updating portfolio for wallet {wallet.id}: {str(e)}")
                continue
        
        logger.info(f"✅ Updated {updated_count} portfolios")
        return {'updated': updated_count, 'total': wallets.count()}
        
    except Exception as e:
        logger.error(f"❌ Error in update_portfolio_values: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _create_transaction_notification(tx: Transaction, status: str):
    """Create notification for transaction status update"""
    try:
        if status == 'confirmed':
            title = "Transaction Confirmed"
            message = f"Your {tx.tx_type} transaction of {tx.amount} {tx.token} has been confirmed"
        elif status == 'failed':
            title = "Transaction Failed"
            message = f"Your {tx.tx_type} transaction of {tx.amount} {tx.token} has failed"
        else:
            return
        
        Notification.objects.create(
            user=tx.user,
            title=title,
            message=message,
            notification_type='transaction',
            metadata={
                'transaction_id': str(tx.id),
                'tx_hash': tx.tx_hash,
                'status': status,
                'amount': str(tx.amount),
                'token': tx.token
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error creating notification: {str(e)}")


def _send_admin_alert(title: str, data: dict):
    """Send alert to admin users"""
    try:
        from apps.users.models import User
        
        # Get all admin users
        admins = User.objects.filter(is_staff=True, is_active=True)
        
        for admin in admins:
            Notification.objects.create(
                user=admin,
                title=title,
                message=str(data),
                notification_type='system',
                metadata=data
            )
            
    except Exception as e:
        logger.error(f"❌ Error sending admin alert: {str(e)}")
