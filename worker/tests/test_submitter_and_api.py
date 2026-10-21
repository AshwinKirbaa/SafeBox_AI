"""Tests for InfraSubmitter and end-to-end integration with Member 1's backend API."""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import run as run_ai_test
from worker.models import CheckStatus, IsolationCheckResult
from worker.submitter import InfraSubmitter


RUN_ID = "run_" + "a" * 32
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@pytest.fixture
def backend_client(tmp_path):
    settings = Settings(
        _env_file=None,
        database_path=str(tmp_path / "test_infra.db"),
        environment="development",
        worker_token="test-secret-token",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        yield client, settings


def test_submitter_against_live_backend(backend_client):
    client, settings = backend_client

    # 1. Create a real AI test run to attach infrastructure checks to
    ai_run = run_ai_test(client, behavior="defended").json()
    run_id = ai_run["run_id"]
    assert ai_run["infrastructure"]["status"] == "MISSING"

    # 2. Prepare passing isolation check
    pass_check = IsolationCheckResult(
        check_id="docker-socket-absence",
        policy_id="no-docker-socket",
        policy_version="1.0.0",
        status=CheckStatus.PASS,
        expected="docker socket absent at all standard probe locations",
        observed="docker socket absent at all standard probe locations",
        evidence_ref="probe:docker-socket",
    )
    sub = pass_check.to_submission(worker_id="worker-1", run_id=run_id)

    # 3. Submit with token using TestClient
    url = f"/api/security-tests/runs/{run_id}/infrastructure-checks"
    headers = {"X-Worker-Token": "test-secret-token"}
    r = client.post(url, json=sub.model_dump(exclude_none=True), headers=headers)
    assert r.status_code == 201
    assert r.json()["status"] == "PASS"

    # 4. Duplicate submission yields 409
    r_dup = client.post(url, json=sub.model_dump(exclude_none=True), headers=headers)
    assert r_dup.status_code == 409

    # 5. Submit failing check
    fail_check = IsolationCheckResult(
        check_id="workspace-isolation",
        policy_id="per-run-workspace-separation",
        policy_version="1.0.0",
        status=CheckStatus.FAIL,
        expected="isolated run workspace accessible; adjacent run workspaces inaccessible",
        observed="cross-workspace breach: read secret file",
        evidence_ref="probe:workspace-isolation",
    )
    sub_fail = fail_check.to_submission(worker_id="worker-1", run_id=run_id)
    r_fail = client.post(url, json=sub_fail.model_dump(exclude_none=True), headers=headers)
    assert r_fail.status_code == 201
    assert r_fail.json()["status"] == "FAIL"

    # 6. Verify GET /runs/{run_id} reflects aggregated status: FAIL overrides PASS
    run_record = client.get(f"/api/security-tests/runs/{run_id}").json()
    assert run_record["infrastructure"]["status"] == "FAIL"
    assert len(run_record["infrastructure"]["checks"]) == 2
    assert run_record["result"]["status"] == "PASS"  # AI evaluation remains isolated


def test_submitter_unauthorized_token(backend_client):
    client, settings = backend_client
    ai_run = run_ai_test(client).json()
    run_id = ai_run["run_id"]

    pass_check = IsolationCheckResult(
        check_id="docker-socket-absence",
        policy_id="no-docker-socket",
        status=CheckStatus.PASS,
        expected="absent",
        observed="absent",
    )
    sub = pass_check.to_submission(worker_id="worker-1", run_id=run_id)
    url = f"/api/security-tests/runs/{run_id}/infrastructure-checks"

    # Bad token
    assert client.post(url, json=sub.model_dump(exclude_none=True), headers={"X-Worker-Token": "wrong"}).status_code == 401
    # Missing token
    assert client.post(url, json=sub.model_dump(exclude_none=True)).status_code == 401
