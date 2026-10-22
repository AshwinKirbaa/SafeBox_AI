"""Integration tests for Model Connections, Discovery, and Capability-Aware Evaluation."""
import json
import httpx
import pytest
from starlette.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import MockBehavior, TargetConfig, TargetMode, TestStatus


@pytest.fixture
def app_client(tmp_path):
    settings = Settings(
        _env_file=None,
        database_path=str(tmp_path / "conn_test.db"),
        target_mode=TargetMode.mock,
        allow_ollama_target=True,
    )
    app = create_app(settings)
    app.state.db.init()
    return TestClient(app)


def test_list_providers(app_client):
    res = app_client.get("/api/connections/providers")
    assert res.status_code == 200
    providers = res.json()
    ids = {p["id"] for p in providers}
    assert "mock" in ids
    assert "ollama" in ids
    assert "openai_compatible" in ids
    assert "openai" in ids
    assert "anthropic" in ids
    assert "gemini" in ids
    assert "huggingface" in ids
    assert "vllm" in ids


def test_create_and_manage_saved_connection(app_client):
    # 1. Create connection with secret
    payload = {
        "name": "Production OpenAI Audit",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-proj-testSecretKey1234567890",
    }
    create_res = app_client.post("/api/connections", json=payload)
    assert create_res.status_code == 201
    conn = create_res.json()
    conn_id = conn["connection_id"]
    assert conn["has_api_key"] is True
    # Secret must be masked and NEVER exposed in the response
    assert "sk-proj-testSecretKey1234567890" not in create_res.text
    assert conn["masked_api_key"] is not None

    # 2. List connections
    list_res = app_client.get("/api/connections")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(i["connection_id"] == conn_id for i in items)

    # 3. Get connection by ID
    get_res = app_client.get(f"/api/connections/{conn_id}")
    assert get_res.status_code == 200
    assert "sk-proj-testSecretKey1234567890" not in get_res.text

    # 4. Patch connection
    patch_res = app_client.patch(f"/api/connections/{conn_id}", json={"model": "gpt-4o"})
    assert patch_res.status_code == 200
    assert patch_res.json()["model"] == "gpt-4o"

    # 5. Delete connection
    del_res = app_client.delete(f"/api/connections/{conn_id}")
    assert del_res.status_code == 204
    assert app_client.get(f"/api/connections/{conn_id}").status_code == 404


def test_connection_test_mock_reachability(app_client):
    res = app_client.post("/api/connections/test", json={
        "provider": "mock",
        "model": "mock-defended",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["reachable"] is True
    assert data["model_available"] is True
    assert "mock-defended" in data["discovered_models"]


def test_unsupported_test_produces_unsupported_verdict(app_client):
    # Run multimodal image test against text-only mock or text-only model
    # Target mock with restricted capability or test capability mismatch
    res = app_client.post("/api/security-tests/run", json={
        "test_id": "structured-output-integrity",
        "target": {"mode": "mock", "mock_behavior": "defended"},
    })
    assert res.status_code == 200
    data = res.json()
    # Mock supports structured output so it passes
    assert data["result"]["status"] == "PASS"


def test_token_usage_and_provider_identity_in_run_record(app_client):
    res = app_client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "mock", "mock_behavior": "vulnerable"},
    })
    assert res.status_code == 200
    data = res.json()
    assert data["target"]["provider"] == "mock"
    assert data["target"]["model"] == "mock-vulnerable"
    assert data["result"]["status"] == "FAIL"

    # Verify run list returns provider and model for filtering
    runs_res = app_client.get("/api/security-tests/runs?provider=mock")
    assert runs_res.status_code == 200
    runs = runs_res.json()["items"]
    assert len(runs) >= 1
    assert runs[0]["provider"] == "mock"


def test_isolation_infrastructure_separation(app_client):
    # 1. Run a test
    res = app_client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "mock", "mock_behavior": "defended"},
    })
    assert res.status_code == 200
    run_id = res.json()["run_id"]

    # AI is PASS, infrastructure starts as MISSING (independent)
    assert res.json()["result"]["status"] == "PASS"
    assert res.json()["infrastructure"]["status"] == "MISSING"

    # 2. Worker submits an infrastructure check failure (e.g. host filesystem breach)
    check_sub = {
        "worker_id": "worker-docker-01",
        "run_id": run_id,
        "check_id": "host-filesystem",
        "policy_id": "fs-isolation",
        "policy_version": "1.0",
        "reported_state": "COMPLETED",
        "observed": "read_write_access",
        "expected": "read_only_or_blocked",
        "timestamp": "2026-10-21T08:00:00.000Z",
    }
    sub_res = app_client.post(f"/api/security-tests/runs/{run_id}/infrastructure-checks", json=check_sub)
    assert sub_res.status_code == 201

    # 3. Query run: AI remains PASS while infrastructure is FAIL (dual independence)
    run_detail = app_client.get(f"/api/security-tests/runs/{run_id}").json()
    assert run_detail["result"]["status"] == "PASS"
    assert run_detail["infrastructure"]["status"] == "FAIL"


def test_verify_live_connection_workflow(app_client):
    # 1. Create a connection for mock
    payload = {
        "name": "Live Verification Mock",
        "provider": "mock",
        "model": "mock-defended",
    }
    c_res = app_client.post("/api/connections", json=payload)
    assert c_res.status_code == 201
    conn_id = c_res.json()["connection_id"]

    # 2. Run live verification on the saved connection
    v_res = app_client.post(f"/api/connections/{conn_id}/verify-live", json={
        "test_id": "canary-disclosure"
    })
    assert v_res.status_code == 200
    vdata = v_res.json()
    assert vdata["reachable"] is True
    assert vdata["model_available"] is True
    assert vdata["inference_executed"] is True
    assert vdata["verdict"] == "PASS"
    assert vdata["run_id"] is not None
    assert "mock-defended" in vdata["discovered_models"]

    # 3. Verify the run is retrievable in audit run history
    run_res = app_client.get(f"/api/security-tests/runs/{vdata['run_id']}")
    assert run_res.status_code == 200
    rdata = run_res.json()
    assert rdata["target"]["provider"] == "mock"
    assert rdata["target"]["connection_id"] == conn_id
    assert rdata["result"]["status"] == "PASS"

    # 4. Test ad-hoc verification with unreachable endpoint (SSRF blocked)
    adhoc_res = app_client.post("/api/connections/verify-live", json={
        "target": {
            "provider": "openai_compatible",
            "base_url": "http://169.254.169.254/v1",
            "model": "gpt-4o"
        },
        "test_id": "canary-disclosure"
    })
    assert adhoc_res.status_code == 200
    adata = adhoc_res.json()
    assert adata["reachable"] is False
    assert adata["inference_executed"] is False
    assert "SSRF" in (adata["error_message"] or "")

