"""Tests for bundler gateway API endpoints."""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from django.contrib.auth import get_user_model

from api.main import app
from api.dependencies import get_current_user
from apps.bundler.models import BundlerJob, UserOperation

User = get_user_model()
client = None


@pytest.fixture
def auth_user(db):
    """Create an authenticated user and override dependency."""

    user = User.objects.create_user(
        email="bundler_tester@example.com",
        password="StrongPass123!",
        email_verified=True,
    )

    # Override dependency and create TestClient after override so it picks up the override
    app.dependency_overrides[get_current_user] = lambda: user
    global client
    client = TestClient(app)
    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        client.close()


def _queue_payload() -> dict:
    return {
        "chain_id": 4202,
        "sender": "0x1234567890abcdef1234567890abcdef12345678",
        "user_op_hash": "0xabc123" + "0" * 58,
        "nonce": "1",
        "endpoint": "https://bundler.mock/rpc",
        "payload": {
            "call_gas_limit": 21000,
            "verification_gas_limit": 150000,
        },
        "metadata": {"source": "test"},
    }


@pytest.mark.django_db(transaction=True)
def test_queue_and_list_operations(auth_user):
    """Queue an operation, ensure it persists and is listable."""

    queue_response = client.post("/api/v1/bundler/operations", json=_queue_payload())
    assert queue_response.status_code == 200, queue_response.json()
    body = queue_response.json()

    operation_id = UUID(body["operation_id"])
    job_id = UUID(body["job_id"])

    assert body["status"] == UserOperation.Status.QUEUED
    assert UserOperation.objects.filter(id=operation_id).exists()
    assert BundlerJob.objects.filter(id=job_id).exists()

    list_response = client.get("/api/v1/bundler/operations")
    assert list_response.status_code == 200
    operations = list_response.json()
    assert any(op["user_op_hash"] == _queue_payload()["user_op_hash"] for op in operations)

    detail_response = client.get(f"/api/v1/bundler/operations/{operation_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["metadata"] == {"source": "test"}
    assert detail["jobs"]

    events_response = client.get(f"/api/v1/bundler/operations/{operation_id}/events")
    assert events_response.status_code == 200
    events = events_response.json()
    assert events
    assert events[0]["event_type"] == "queued"


@pytest.mark.django_db(transaction=True)
def test_dispatch_and_mark_included_flow(auth_user):
    """Dispatch queued job and mark it as included."""

    queue_resp = client.post("/api/v1/bundler/operations", json=_queue_payload())
    operation_id = queue_resp.json()["operation_id"]
    job_id = queue_resp.json()["job_id"]

    dispatch_resp = client.post("/api/v1/bundler/jobs/dispatch", params={"batch_size": 5})
    assert dispatch_resp.status_code == 200, dispatch_resp.json()
    dispatch_body = dispatch_resp.json()
    assert dispatch_body["count"] >= 1
    assert job_id in dispatch_body["job_ids"]

    mark_resp = client.post(
        f"/api/v1/bundler/operations/{operation_id}/mark-included",
        json={
            "job_id": job_id,
            "transaction_hash": "0x" + "1" * 64,
        },
    )
    assert mark_resp.status_code == 200, mark_resp.json()
    assert mark_resp.json()["success"] is True

    operation = UserOperation.objects.get(id=operation_id)
    assert operation.status == UserOperation.Status.INCLUDED
    assert operation.metadata.get("tx_hash")

    job = BundlerJob.objects.get(id=job_id)
    assert job.status == BundlerJob.Status.SUCCEEDED

    events = client.get(f"/api/v1/bundler/operations/{operation_id}/events").json()
    assert any(event["event_type"] == "included" for event in events)