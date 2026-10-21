from datetime import datetime, timezone

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from tests.conftest import run

RUN_URL = "/api/security-tests/run"
NOW = datetime.now(timezone.utc).isoformat()


def infra_body(run_id, **kw):
    b = dict(worker_id="worker-1", run_id=run_id, check_id="net-egress", policy_id="egress-deny",
             policy_version="1", observed="blocked", expected="blocked", timestamp=NOW,
             evidence_ref="worker-log:abc")
    return {**b, **kw}


def test_health(client):
    j = client.get("/api/health").json()
    assert j["status"] == "ok" and j["target_mode"] == "mock" and j["database_ok"] and j["ollama"] is None


def test_starts_in_mock_mode_without_ollama(settings):
    with TestClient(create_app(settings)) as c:   # no Ollama anywhere
        assert run(c, behavior="vulnerable").json()["result"]["status"] == "FAIL"


def test_list_tests(client):
    items = client.get("/api/security-tests").json()["items"]
    assert {i["test_id"] for i in items} == {
        "canary-disclosure", "instruction-conflict", "prohibited-string",
        "indirect-injection", "system-prompt-extraction", "benign-control", "repeatability",
        "structured-output-integrity", "tool-call-authorization", "multimodal-image-canary"
    }
    assert all(i["version"] and i["rule_id"] and i["limitations"] for i in items)


def test_run_vulnerable_and_defended(client):
    f = run(client, behavior="vulnerable")
    p = run(client, behavior="defended")
    assert f.status_code == p.status_code == 200
    assert f.json()["result"]["status"] == "FAIL" and p.json()["result"]["status"] == "PASS"
    j = f.json()
    assert j["state"] == "COMPLETED" and j["result_type"] == "ai_behavior_test"
    assert j["result"]["started_at"].endswith("Z") and j["infrastructure"]["status"] == "MISSING"


def test_get_run_and_history_pagination(client):
    ids = [run(client, behavior="defended").json()["run_id"] for _ in range(3)]
    assert client.get(f"/api/security-tests/runs/{ids[0]}").json()["run_id"] == ids[0]
    page = client.get("/api/security-tests/runs?limit=2&offset=0").json()
    assert page["total"] == 3 and len(page["items"]) == 2 and page["has_more"] is True
    assert page["items"][0]["run_id"] == ids[-1]  # newest first
    last = client.get("/api/security-tests/runs?limit=2&offset=2").json()
    assert len(last["items"]) == 1 and last["has_more"] is False


def test_history_limit_is_bounded(client):
    assert client.get("/api/security-tests/runs?limit=1000").status_code == 422
    assert client.get("/api/security-tests/runs?limit=0").status_code == 422
    assert client.get("/api/security-tests/runs?offset=-1").status_code == 422


def test_unknown_run_404_and_malformed_id_422(client):
    assert client.get("/api/security-tests/runs/run_" + "0" * 32).status_code == 404
    assert client.get("/api/security-tests/runs/not-an-id").status_code == 422


def test_unknown_test_rejected(client):
    r = client.post(RUN_URL, json={"test_id": "no-such-test"})
    assert r.status_code == 404 and r.json()["error"]["code"] == "unknown_test"


def test_malformed_requests_rejected(client):
    assert client.post(RUN_URL, json={}).status_code == 422
    assert client.post(RUN_URL, content=b"{not json", headers={"content-type": "application/json"}).status_code == 422
    assert client.post(RUN_URL, json={"test_id": "x"}).status_code == 422
    r = client.post(RUN_URL, json={"test_id": "canary-disclosure", "target": {"mode": "mock", "url": "http://evil"}})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_invalid_target_mode_rejected(client):
    assert client.post(RUN_URL, json={"test_id": "canary-disclosure", "target": {"mode": "docker"}}).status_code == 422
    r = client.post(RUN_URL, json={"test_id": "canary-disclosure", "target": {"mode": "ollama"}})
    assert r.status_code == 400 and r.json()["error"]["code"] == "target_mode_not_permitted"


def test_oversized_request_rejected(client):
    r = client.post(RUN_URL, content=b"x" * 20000, headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_error_and_timeout_via_api(client):
    assert run(client, behavior="error").json()["result"]["status"] == "ERROR"
    assert run(client, behavior="timeout").json()["result"]["status"] == "ERROR"


def test_response_never_contains_canary(client):
    assert "CANARY-SAFEBOX" not in run(client, behavior="vulnerable").text


def test_infrastructure_flow(client):
    rid = run(client).json()["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"
    r = client.post(url, json=infra_body(rid))
    assert r.status_code == 201 and r.json()["status"] == "PASS"
    assert client.post(url, json=infra_body(rid)).status_code == 409           # duplicate
    r2 = client.post(url, json=infra_body(rid, check_id="fs-ro", observed="writable"))
    assert r2.json()["status"] == "FAIL"
    rec = client.get(f"/api/security-tests/runs/{rid}").json()
    assert rec["infrastructure"]["status"] == "FAIL" and len(rec["infrastructure"]["checks"]) == 2
    assert rec["result"]["status"] == "PASS"  # AI verdict unaffected by infra results


def test_infrastructure_pending_unavailable_error_never_pass(client):
    rid = run(client).json()["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"
    client.post(url, json=infra_body(rid, check_id="a"))
    r = client.post(url, json=infra_body(rid, check_id="b", reported_state="PENDING",
                                         observed=None, expected=None))
    assert r.json()["status"] == "PENDING"
    assert client.get(f"/api/security-tests/runs/{rid}").json()["infrastructure"]["status"] == "PENDING"
    r = client.post(url, json=infra_body(rid, check_id="c", observed=None, expected=None, error="crash"))
    assert r.json()["status"] == "ERROR"


def test_infrastructure_validation(client):
    rid = run(client).json()["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"
    other = "run_" + "b" * 32
    assert client.post(url, json=infra_body(other)).status_code == 422          # id mismatch
    ghost = "run_" + "c" * 32
    assert client.post(f"/api/security-tests/runs/{ghost}/infrastructure-checks",
                       json=infra_body(ghost)).status_code == 404
    assert client.post(url, json=infra_body(rid, observed=None)).status_code == 422


def test_vulnerable_mock_fails_redacts_canary_and_coexists_with_all_seven_infra_checks(client):
    # 1. Run vulnerable mock canary-disclosure test
    resp = client.post(
        RUN_URL,
        json={"test_id": "canary-disclosure", "target": {"mode": "mock", "mock_behavior": "vulnerable"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    run_id = data["run_id"]

    # 2. AI evaluation is FAIL
    assert data["result"]["status"] == "FAIL"
    assert "canary_exact_match" in data["result"]["matched_indicators"]

    # 3. Evidence redaction: canary is replaced with [REDACTED] in returned evidence
    assert "CANARY-SAFEBOX" not in resp.text
    model_output_evidence = [e for e in data["evidence"] if e["kind"] == "model_output"]
    assert len(model_output_evidence) == 1
    assert model_output_evidence[0]["redacted"] is True
    assert "[REDACTED]" in model_output_evidence[0]["content"]

    # 4. Initial infrastructure status is MISSING
    assert data["infrastructure"]["status"] == "MISSING"

    # 5. Submit all seven infrastructure checks as PASS
    checks = [
        ("docker-socket-absence", "no-docker-socket", "docker socket absent", "docker socket absent"),
        ("non-root-execution", "non-root-user", "non-root user", "non-root user"),
        ("dropped-capabilities", "cap-drop-all", "CapEff=0000000000000000", "CapEff=0000000000000000"),
        ("resource-limits", "bounded-resources", "memory and pids limited", "memory and pids limited"),
        ("workspace-isolation", "workspace-sep", "workspace isolated", "workspace isolated"),
        ("host-filesystem-protection", "no-host-mounts", "host protected", "host protected"),
        ("network-egress", "egress-deny-all", "egress blocked", "egress blocked"),
    ]
    url = f"/api/security-tests/runs/{run_id}/infrastructure-checks"
    for check_id, policy_id, obs, exp in checks:
        body = infra_body(run_id, check_id=check_id, policy_id=policy_id, observed=obs, expected=exp)
        r = client.post(url, json=body)
        assert r.status_code == 201
        assert r.json()["status"] == "PASS"

    # 6. Retrieve the run and verify AI FAIL and Infrastructure PASS coexist
    rec = client.get(f"/api/security-tests/runs/{run_id}").json()
    assert rec["result"]["status"] == "FAIL"
    assert rec["infrastructure"]["status"] == "PASS"
    assert len(rec["infrastructure"]["checks"]) == 7
    recorded_check_ids = [c["check_id"] for c in rec["infrastructure"]["checks"]]
    assert set(recorded_check_ids) == {c[0] for c in checks}

    # 7. Canary remains absent and redacted on subsequent retrieval
    assert "CANARY-SAFEBOX" not in client.get(f"/api/security-tests/runs/{run_id}").text

