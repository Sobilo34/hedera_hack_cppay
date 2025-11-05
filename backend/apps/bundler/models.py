"""Data models for the bundler gateway domain."""

import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class UserOperation(models.Model):
    """Queue record for a user operation that will be dispatched to a bundler."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        DISPATCHED = "dispatched", "Dispatched"
        INCLUDED = "included", "Included"
        FAILED = "failed", "Failed"
        DROPPED = "dropped", "Dropped"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chain_id = models.PositiveBigIntegerField(db_index=True)
    sender = models.CharField(max_length=42, db_index=True)
    wallet = models.ForeignKey(
        'wallets.Wallet',
        on_delete=models.SET_NULL,
        related_name='user_operations',
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='user_operations',
        null=True,
        blank=True,
    )

    user_op_hash = models.CharField(max_length=66, unique=True)
    nonce = models.CharField(max_length=120)
    call_data = models.BinaryField(blank=True, null=True)
    call_gas_limit = models.BigIntegerField(default=0)
    verification_gas_limit = models.BigIntegerField(default=0)
    pre_verification_gas = models.BigIntegerField(default=0)
    max_fee_per_gas = models.BigIntegerField(default=0)
    max_priority_fee_per_gas = models.BigIntegerField(default=0)
    paymaster = models.CharField(max_length=42, blank=True)

    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    failure_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    queued_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-queued_at']
        indexes = [
            models.Index(fields=['chain_id', 'status']),
            models.Index(fields=['queued_at']),
        ]

    def mark_status(self, status: str, *, reason: str | None = None) -> None:
        """Update the status and optional error reason."""
        valid_status = status if status in self.Status.values else self.Status.FAILED
        self.status = valid_status
        if reason:
            self.failure_reason = reason
        if valid_status in {self.Status.INCLUDED, self.Status.FAILED, self.Status.DROPPED}:
            self.completed_at = timezone.now()
        self.save(update_fields=['status', 'failure_reason', 'completed_at', 'updated_at'])

    def __str__(self) -> str:  # pragma: no cover - repr helper
        return f"{self.sender}@{self.chain_id} :: {self.user_op_hash}"


class BundlerJob(models.Model):
    """Dispatch attempts for a queued operation against a configured bundler endpoint."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        DISPATCHING = "dispatching", "Dispatching"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        RETRYING = "retrying", "Retrying"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_operation = models.ForeignKey(
        UserOperation,
        on_delete=models.CASCADE,
        related_name='jobs',
    )
    target_endpoint = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    attempt_count = models.PositiveIntegerField(default=0)
    priority = models.PositiveSmallIntegerField(default=100)
    last_error = models.TextField(blank=True)

    enqueued_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_attempt_at = models.DateTimeField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority', 'enqueued_at']
        indexes = [
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['enqueued_at']),
        ]

    def touch_attempt(self, *, error: str | None = None) -> None:
        """Increment attempt count and optionally persist the latest error."""
        self.attempt_count += 1
        self.last_attempt_at = timezone.now()
        if error:
            self.last_error = error
        self.save(update_fields=['attempt_count', 'last_attempt_at', 'last_error', 'updated_at'])

    def __str__(self) -> str:  # pragma: no cover - repr helper
        return f"Job({self.id}) -> {self.target_endpoint} [{self.status}]"


class UserOperationEvent(models.Model):
    """Structured audit log for user operation lifecycle events."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_operation = models.ForeignKey(
        UserOperation,
        on_delete=models.CASCADE,
        related_name='events',
    )
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['event_type', 'created_at'])]

    def __str__(self) -> str:  # pragma: no cover - repr helper
        return f"{self.user_operation_id}::{self.event_type}"
