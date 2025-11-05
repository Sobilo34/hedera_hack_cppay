"""Celery tasks for orchestrating bundler gateway workflows."""

import logging
from celery import shared_task

from services.bundler import BundlerGatewayService

logger = logging.getLogger(__name__)


@shared_task(name='bundler.dispatch_user_operations')
def dispatch_user_operations(batch_size: int = 10) -> dict:
    """Pop the next batch of queued operations and dispatch them to the bundler."""
    service = BundlerGatewayService()
    dispatched = service.dispatch_batch(batch_size=batch_size)
    logger.info("🚀 Dispatched %s user operations", dispatched.get('count', 0))
    return dispatched


@shared_task(name='bundler.sync_inflight_operations')
def sync_inflight_operations(limit: int = 50) -> dict:
    """Refresh execution status for inflight operations from bundler receipts."""
    service = BundlerGatewayService()
    sync_result = service.reconcile_inflight(limit=limit)
    logger.info("📡 Reconciled %s inflight operations", sync_result.get('processed', 0))
    return sync_result
