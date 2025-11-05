"""Bundler gateway orchestration primitives."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable, Mapping, MutableMapping

from django.db import transaction
from django.utils import timezone

from apps.bundler.models import BundlerJob, UserOperation, UserOperationEvent

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class QueuedOperation:
    """Lightweight representation of a freshly queued operation."""

    user_operation: UserOperation
    bundler_job: BundlerJob


class BundlerGatewayService:
    """Facade that coordinates bundler dispatch and reconciliation."""

    def queue_operation(
        self,
        *,
        chain_id: int,
        sender: str,
        user_op_hash: str,
        nonce: str,
        endpoint: str,
        payload: MutableMapping[str, int | str | bytes] | None = None,
        metadata: Mapping[str, object] | None = None,
    ) -> QueuedOperation:
        """Persist a queued user operation alongside its first job."""
        payload = payload or {}
        metadata = metadata or {}

        with transaction.atomic():
            user_operation, _ = UserOperation.objects.select_for_update().get_or_create(
                user_op_hash=user_op_hash,
                defaults={
                    'chain_id': chain_id,
                    'sender': sender,
                    'nonce': nonce,
                    'call_data': payload.get('call_data'),
                    'call_gas_limit': int(payload.get('call_gas_limit', 0) or 0),
                    'verification_gas_limit': int(payload.get('verification_gas_limit', 0) or 0),
                    'pre_verification_gas': int(payload.get('pre_verification_gas', 0) or 0),
                    'max_fee_per_gas': int(payload.get('max_fee_per_gas', 0) or 0),
                    'max_priority_fee_per_gas': int(payload.get('max_priority_fee_per_gas', 0) or 0),
                    'metadata': metadata,
                },
            )

            if user_operation.status != UserOperation.Status.QUEUED:
                user_operation.status = UserOperation.Status.QUEUED
                user_operation.failure_reason = ""
                user_operation.completed_at = None
                user_operation.save(update_fields=['status', 'failure_reason', 'completed_at', 'updated_at'])

            job = BundlerJob.objects.create(
                user_operation=user_operation,
                target_endpoint=endpoint,
                metadata={'attempt_context': 'initial'},
            )

            UserOperationEvent.objects.create(
                user_operation=user_operation,
                event_type='queued',
                payload={'endpoint': endpoint},
            )

        logger.info("📥 Queued user operation %s for chain %s", user_op_hash, chain_id)
        return QueuedOperation(user_operation=user_operation, bundler_job=job)

    def dispatch_batch(self, *, batch_size: int = 10) -> dict:
        """Claim the next batch of jobs and mark them for dispatch."""
        claimed: list[BundlerJob] = []
        now = timezone.now()

        with transaction.atomic():
            queued_jobs = (
                BundlerJob.objects.select_for_update(skip_locked=True)
                .select_related('user_operation')
                .filter(status__in=[BundlerJob.Status.QUEUED, BundlerJob.Status.RETRYING])
                .order_by('priority', 'enqueued_at')[:batch_size]
            )

            for job in queued_jobs:
                job.status = BundlerJob.Status.DISPATCHING
                job.attempt_count += 1
                job.last_attempt_at = now
                job.last_error = ""
                job.save(update_fields=['status', 'attempt_count', 'last_attempt_at', 'last_error', 'updated_at'])
                claimed.append(job)

                job.user_operation.status = UserOperation.Status.DISPATCHED
                job.user_operation.save(update_fields=['status', 'updated_at'])

                UserOperationEvent.objects.create(
                    user_operation=job.user_operation,
                    event_type='dispatching',
                    payload={'job_id': str(job.id), 'endpoint': job.target_endpoint},
                )

        if not claimed:
            return {'count': 0, 'job_ids': []}

        logger.debug("🚚 Claimed %s bundler jobs", len(claimed))
        return {
            'count': len(claimed),
            'job_ids': [str(job.id) for job in claimed],
            'operation_hashes': [job.user_operation.user_op_hash for job in claimed],
        }

    def reconcile_inflight(self, *, limit: int = 50) -> dict:
        """Retry stalled dispatches by re-queuing or failing them."""
        cutoff = timezone.now() - timedelta(minutes=5)
        inflight = (
            BundlerJob.objects.select_related('user_operation')
            .filter(status=BundlerJob.Status.DISPATCHING, last_attempt_at__lt=cutoff)
            .order_by('last_attempt_at')[:limit]
        )

        if not inflight:
            return {'processed': 0, 'requeued': 0, 'failed': 0}

        requeued = 0
        failed = 0

        with transaction.atomic():
            for job in inflight:
                if job.attempt_count >= 3:
                    job.status = BundlerJob.Status.FAILED
                    job.last_error = job.last_error or 'Dispatch attempts exceeded'
                    job.save(update_fields=['status', 'last_error', 'updated_at'])
                    job.user_operation.mark_status(UserOperation.Status.FAILED, reason=job.last_error)
                    UserOperationEvent.objects.create(
                        user_operation=job.user_operation,
                        event_type='failed',
                        payload={'job_id': str(job.id), 'reason': job.last_error},
                    )
                    failed += 1
                    continue

                job.status = BundlerJob.Status.RETRYING
                job.save(update_fields=['status', 'updated_at'])
                job.user_operation.status = UserOperation.Status.QUEUED
                job.user_operation.save(update_fields=['status', 'updated_at'])
                UserOperationEvent.objects.create(
                    user_operation=job.user_operation,
                    event_type='requeued',
                    payload={'job_id': str(job.id)},
                )
                requeued += 1

        logger.warning(
            "♻️ Reconciled %s inflight jobs (requeued=%s failed=%s)",
            len(inflight),
            requeued,
            failed,
        )
        return {'processed': len(inflight), 'requeued': requeued, 'failed': failed}

    def mark_included(self, *, job_id: str, tx_hash: str) -> None:
        """Mark a job as included on-chain and propagate to the operation."""
        with transaction.atomic():
            job = BundlerJob.objects.select_related('user_operation').get(id=job_id)
            job.status = BundlerJob.Status.SUCCEEDED
            job.last_error = ""
            job.save(update_fields=['status', 'last_error', 'updated_at'])

            user_operation = job.user_operation
            operation_hash = user_operation.user_op_hash
            user_operation.status = UserOperation.Status.INCLUDED
            user_operation.metadata = {
                **user_operation.metadata,
                'tx_hash': tx_hash,
            }
            user_operation.completed_at = timezone.now()
            user_operation.save(update_fields=['status', 'metadata', 'completed_at', 'updated_at'])

            UserOperationEvent.objects.create(
                user_operation=user_operation,
                event_type='included',
                payload={'job_id': str(job.id), 'tx_hash': tx_hash},
            )

        logger.info("✅ Marked user operation %s as included", operation_hash)
