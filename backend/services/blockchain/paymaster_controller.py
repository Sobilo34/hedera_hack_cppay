"""Paymaster controller service for budget monitoring and replenishment workflows."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional

from django.db import transaction
from django.utils import timezone

from apps.gas_sponsorship.models import (
    PaymasterBudgetSnapshot,
    PaymasterReplenishmentRequest,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SnapshotEnvelope:
    """Structured payload representing a recorded snapshot."""

    balance_wei: int
    deposit_wei: int
    estimated_daily_burn_wei: int
    block_number: Optional[int]
    observed_at: str


class PaymasterControllerService:
    """Coordinates state between on-chain paymaster data and operator workflows."""

    def __init__(self, *, chain_id: int, paymaster_address: str):
        self.chain_id = chain_id
        self.paymaster_address = paymaster_address.lower()

    # ---------------------------------------------------------------------
    # Snapshot lifecycle
    # ---------------------------------------------------------------------
    def record_snapshot(
        self,
        *,
        native_balance_wei: int,
        entry_point_deposit_wei: int,
        estimated_daily_burn_wei: int = 0,
        block_number: Optional[int] = None,
        metadata: Optional[dict] = None,
    ) -> SnapshotEnvelope:
        """Persist a new snapshot for monitoring dashboards."""
        metadata = metadata or {}
        snapshot = PaymasterBudgetSnapshot.objects.create(
            chain_id=self.chain_id,
            paymaster_address=self.paymaster_address,
            native_balance_wei=native_balance_wei,
            entry_point_deposit_wei=entry_point_deposit_wei,
            estimated_daily_burn_wei=estimated_daily_burn_wei,
            block_number=block_number,
            metadata=metadata,
        )
        logger.debug(
            "📊 Snapshot recorded for %s on chain %s (balance=%s wei)",
            self.paymaster_address,
            self.chain_id,
            native_balance_wei,
        )
        return SnapshotEnvelope(
            balance_wei=snapshot.native_balance_wei,
            deposit_wei=snapshot.entry_point_deposit_wei,
            estimated_daily_burn_wei=snapshot.estimated_daily_burn_wei,
            block_number=snapshot.block_number,
            observed_at=snapshot.observed_at.isoformat(),
        )

    def latest_snapshot(self) -> Optional[PaymasterBudgetSnapshot]:
        """Return the most recent snapshot, if one exists."""
        return (
            PaymasterBudgetSnapshot.objects.filter(
                chain_id=self.chain_id,
                paymaster_address=self.paymaster_address,
            )
            .order_by('-observed_at')
            .first()
        )

    def needs_replenishment(self, *, floor_balance_wei: int) -> bool:
        """Determine whether a top-up alert needs to be raised."""
        snapshot = self.latest_snapshot()
        if not snapshot:
            logger.warning("⚠️ No snapshots recorded for paymaster %s", self.paymaster_address)
            return True
        projected_balance = snapshot.native_balance_wei - snapshot.estimated_daily_burn_wei
        return projected_balance < floor_balance_wei

    # ---------------------------------------------------------------------
    # Replenishment workflow
    # ---------------------------------------------------------------------
    def open_replenishment_request(
        self,
        *,
        amount_wei: int,
        direction: str = 'deposit',
        requested_by=None,
        context: Optional[dict] = None,
    ) -> PaymasterReplenishmentRequest:
        """Create a replenishment task for operators or automation."""
        context = context or {}
        request = PaymasterReplenishmentRequest.objects.create(
            chain_id=self.chain_id,
            paymaster_address=self.paymaster_address,
            amount_wei=amount_wei,
            direction=direction,
            raised_by=requested_by,
            context=context,
        )
        logger.info(
            "📝 Replenishment request %s opened for %s wei (%s)",
            request.id,
            amount_wei,
            direction,
        )
        return request

    def transition_request(
        self,
        *,
        request_id: str,
        status: str,
        error: Optional[str] = None,
    ) -> PaymasterReplenishmentRequest:
        """Transition the request to a new status with bookkeeping."""
        request = PaymasterReplenishmentRequest.objects.get(id=request_id)
        request.mark_status(status, error=error)
        logger.debug(
            "🔄 Request %s moved to %s (error=%s)",
            request_id,
            status,
            error,
        )
        return request

    def ensure_single_pending(self) -> Optional[PaymasterReplenishmentRequest]:
        """Return the active pending request or None if none exists."""
        return (
            PaymasterReplenishmentRequest.objects.filter(
                chain_id=self.chain_id,
                paymaster_address=self.paymaster_address,
                status=PaymasterReplenishmentRequest.Status.PENDING,
            )
            .order_by('created_at')
            .first()
        )

    def summarize_open_requests(self) -> Iterable[dict]:
        """Lightweight summary of outstanding requests for observability."""
        open_requests = PaymasterReplenishmentRequest.objects.filter(
            chain_id=self.chain_id,
            paymaster_address=self.paymaster_address,
            status__in=[
                PaymasterReplenishmentRequest.Status.PENDING,
                PaymasterReplenishmentRequest.Status.EXECUTING,
            ],
        ).order_by('created_at')

        for item in open_requests:
            yield {
                'id': str(item.id),
                'amount_wei': item.amount_wei,
                'direction': item.direction,
                'status': item.status,
                'created_at': item.created_at.isoformat(),
                'context': item.context,
            }

    # ------------------------------------------------------------------
    # Convenience hooks for automation
    # ------------------------------------------------------------------
    def auto_open_when_below(self, *, floor_balance_wei: int, top_up_amount_wei: int) -> Optional[str]:
        """Create a pending replenishment ticket if the balance has dropped below the floor."""
        if not self.needs_replenishment(floor_balance_wei=floor_balance_wei):
            return None

        existing = self.ensure_single_pending()
        if existing:
            logger.debug("ℹ️ Pending request %s already open", existing.id)
            return str(existing.id)

        request = self.open_replenishment_request(amount_wei=top_up_amount_wei)
        return str(request.id)
