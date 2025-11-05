"""Bundler Gateway API Router."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.dependencies import get_current_user
from apps.users.models import User
from apps.bundler.models import BundlerJob, UserOperation, UserOperationEvent
from services.bundler import BundlerGatewayService

router = APIRouter(prefix="/bundler")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class OperationPayload(BaseModel):
    call_data: Optional[str] = Field(
        None,
        description="Hex encoded calldata"
    )
    call_gas_limit: Optional[int] = 0
    verification_gas_limit: Optional[int] = 0
    pre_verification_gas: Optional[int] = 0
    max_fee_per_gas: Optional[int] = 0
    max_priority_fee_per_gas: Optional[int] = 0


class QueueOperationRequest(BaseModel):
    chain_id: int = Field(..., description="Target chain ID")
    sender: str = Field(..., description="Smart account address")
    user_op_hash: str = Field(..., description="UserOperation hash")
    nonce: str = Field(..., description="UserOperation nonce")
    endpoint: str = Field(..., description="Bundler endpoint to dispatch to")
    payload: OperationPayload = Field(default_factory=OperationPayload)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QueueOperationResponse(BaseModel):
    operation_id: UUID
    job_id: UUID
    status: str


class DispatchResponse(BaseModel):
    count: int
    job_ids: List[str]
    operation_hashes: List[str]


class ReconcileResponse(BaseModel):
    processed: int
    requeued: int
    failed: int


class OperationSummary(BaseModel):
    id: UUID
    chain_id: int
    sender: str
    user_op_hash: str
    status: str
    queued_at: str
    last_updated: str
    last_error: Optional[str]


class JobSummary(BaseModel):
    id: UUID
    target_endpoint: str
    status: str
    attempt_count: int
    priority: int
    last_error: Optional[str]
    last_attempt_at: Optional[str]


class OperationDetail(OperationSummary):
    jobs: List[JobSummary]
    metadata: Dict[str, Any]
    completed_at: Optional[str]


class OperationEvent(BaseModel):
    id: UUID
    event_type: str
    payload: Dict[str, Any]
    created_at: str


class MarkIncludedRequest(BaseModel):
    job_id: UUID
    transaction_hash: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _coerce_payload(payload: OperationPayload) -> Dict[str, Any]:
    data: Dict[str, Any] = {}

    if payload.call_data:
        cleaned = payload.call_data[2:] if payload.call_data.startswith("0x") else payload.call_data
        try:
            data["call_data"] = bytes.fromhex(cleaned)
        except ValueError as exc:  # pragma: no cover - validation guard
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid call_data provided: {exc}"
            )

    numeric_fields = {
        "call_gas_limit": payload.call_gas_limit,
        "verification_gas_limit": payload.verification_gas_limit,
        "pre_verification_gas": payload.pre_verification_gas,
        "max_fee_per_gas": payload.max_fee_per_gas,
        "max_priority_fee_per_gas": payload.max_priority_fee_per_gas,
    }
    data.update({k: int(v) for k, v in numeric_fields.items() if v})
    return data


def _serialize_operation(operation: UserOperation) -> OperationSummary:
    last_error = operation.failure_reason or None
    return OperationSummary(
        id=operation.id,
        chain_id=operation.chain_id,
        sender=operation.sender,
        user_op_hash=operation.user_op_hash,
        status=operation.status,
        queued_at=operation.queued_at.isoformat(),
        last_updated=operation.updated_at.isoformat(),
        last_error=last_error,
    )


async def _serialize_operation_detail(operation: UserOperation) -> OperationDetail:
    jobs = await sync_to_async(lambda: list(operation.jobs.all()), thread_sensitive=True)()
    job_summaries = [
        JobSummary(
            id=job.id,
            target_endpoint=job.target_endpoint,
            status=job.status,
            attempt_count=job.attempt_count,
            priority=job.priority,
            last_error=job.last_error or None,
            last_attempt_at=job.last_attempt_at.isoformat() if job.last_attempt_at else None,
        )
        for job in jobs
    ]
    base_summary = _serialize_operation(operation)
    return OperationDetail(
        **base_summary.model_dump(),
        jobs=job_summaries,
        metadata=operation.metadata,
        completed_at=operation.completed_at.isoformat() if operation.completed_at else None,
    )


async def _serialize_events(operation: UserOperation) -> List[OperationEvent]:
    events = await sync_to_async(
        lambda: list(operation.events.all().order_by("created_at")),
        thread_sensitive=True,
    )()
    return [
        OperationEvent(
            id=event.id,
            event_type=event.event_type,
            payload=event.payload,
            created_at=event.created_at.isoformat(),
        )
        for event in events
    ]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/operations", response_model=QueueOperationResponse)
async def queue_operation(
    request: QueueOperationRequest,
    current_user: User = Depends(get_current_user),
):
    """Queue a UserOperation for bundler dispatch."""

    gateway = BundlerGatewayService()

    payload = _coerce_payload(request.payload)

    def _queue() -> Dict[str, Any]:
        queued = gateway.queue_operation(
            chain_id=request.chain_id,
            sender=request.sender,
            user_op_hash=request.user_op_hash,
            nonce=request.nonce,
            endpoint=request.endpoint,
            payload=payload,
            metadata=request.metadata,
        )
        return {
            "operation_id": queued.user_operation.id,
            "job_id": queued.bundler_job.id,
            "status": queued.user_operation.status,
        }

    try:
        result = await sync_to_async(_queue, thread_sensitive=True)()
    except Exception as exc:  # pragma: no cover - guarded behaviour
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return QueueOperationResponse(**result)


@router.get("/operations", response_model=List[OperationSummary])
async def list_operations(
    status_filter: Optional[str] = Query(None, alias="status"),
    chain_id: Optional[int] = None,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """List recent UserOperations."""

    def _fetch() -> List[UserOperation]:
        queryset = UserOperation.objects.all()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if chain_id:
            queryset = queryset.filter(chain_id=chain_id)
        return list(queryset.order_by("-queued_at")[:limit])

    operations = await sync_to_async(_fetch, thread_sensitive=True)()
    return [_serialize_operation(op) for op in operations]


@router.get("/operations/{operation_id}", response_model=OperationDetail)
async def get_operation_detail(
    operation_id: UUID,
    current_user: User = Depends(get_current_user),
):
    """Retrieve a specific UserOperation with job metadata."""

    def _get() -> UserOperation:
        return UserOperation.objects.select_related().get(id=operation_id)

    try:
        operation = await sync_to_async(_get, thread_sensitive=True)()
    except UserOperation.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    return await _serialize_operation_detail(operation)


@router.get("/operations/{operation_id}/events", response_model=List[OperationEvent])
async def get_operation_events(
    operation_id: UUID,
    current_user: User = Depends(get_current_user),
):
    """Return audit events for an operation."""

    def _get() -> UserOperation:
        return UserOperation.objects.get(id=operation_id)

    try:
        operation = await sync_to_async(_get, thread_sensitive=True)()
    except UserOperation.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    return await _serialize_events(operation)


@router.post("/jobs/dispatch", response_model=DispatchResponse)
async def dispatch_jobs(
    batch_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Dispatch queued bundler jobs."""

    gateway = BundlerGatewayService()

    def _dispatch() -> Dict[str, Any]:
        return gateway.dispatch_batch(batch_size=batch_size)

    result = await sync_to_async(_dispatch, thread_sensitive=True)()
    return DispatchResponse(**result)


@router.post("/jobs/reconcile", response_model=ReconcileResponse)
async def reconcile_inflight(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    """Retry or fail inflight jobs that exceeded the retry window."""

    gateway = BundlerGatewayService()

    def _reconcile() -> Dict[str, Any]:
        return gateway.reconcile_inflight(limit=limit)

    result = await sync_to_async(_reconcile, thread_sensitive=True)()
    return ReconcileResponse(**result)


@router.post("/operations/{operation_id}/mark-included")
async def mark_operation_included(
    operation_id: UUID,
    request: MarkIncludedRequest,
    current_user: User = Depends(get_current_user),
):
    """Mark the related job and operation as included on-chain."""

    gateway = BundlerGatewayService()

    def _mark() -> None:
        gateway.mark_included(job_id=str(request.job_id), tx_hash=request.transaction_hash)

    try:
        await sync_to_async(_mark, thread_sensitive=True)()
    except (BundlerJob.DoesNotExist, UserOperation.DoesNotExist):  # pragma: no cover - guard
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job or operation not found")

    return {"success": True}


@router.get("/jobs", response_model=List[JobSummary])
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    limit: int = Query(25, ge=1, le=100),
):
    """List bundler jobs across operations."""

    def _fetch() -> List[BundlerJob]:
        queryset = BundlerJob.objects.select_related("user_operation")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return list(queryset.order_by("priority", "enqueued_at")[:limit])

    jobs = await sync_to_async(_fetch, thread_sensitive=True)()
    summaries = [
        JobSummary(
            id=job.id,
            target_endpoint=job.target_endpoint,
            status=job.status,
            attempt_count=job.attempt_count,
            priority=job.priority,
            last_error=job.last_error or None,
            last_attempt_at=job.last_attempt_at.isoformat() if job.last_attempt_at else None,
        )
        for job in jobs
    ]
    return summaries