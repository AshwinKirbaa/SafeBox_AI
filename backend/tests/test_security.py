import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from tests.conftest import run
from tests.test_api import infra_body


def test_no_dangerous_routes(client):
    paths = {p.lower() for p in client.get("/openapi.json").json()["paths"]}
    for bad in ("exec", "shell", "eval", "scan", "proxy", "fetch", "command"):
        assert not any(bad in p for p in paths), bad


def test_no_free_form_target_or_command_fields(client):
    for payload in ({"url": "http://169.254.169.254"}, {"command": "calc.exe"}, {"code": "print(1)"}):
        r = client.post("/api/security-tests/run", json={"test_id": "canary-disclosure", **payload})
        assert r.status_code == 422


def test_validation_errors_do_not_echo_input(client):
    secret = "SUPER-SECRET-VALUE-123"
    r = client.post("/api/security-tests/run", json={"test_id": "canary-disclosure", "target": {"mode": secret}})
    assert r.status_code == 422 and secret not in r.text


def test_sql_injection_style_ids_rejected(client):
    assert client.get("/api/security-tests/runs/run_x'; DROP TABLE runs;--").status_code == 422
    run(client)
    assert client.get("/api/security-tests/runs").json()["total"] == 1


def test_unhandled_error_hides_details(settings):
    def boom(s, t):
        raise RuntimeError("secret internal path C:\\Users\\x")

    with TestClient(create_app(settings, adapter_factory=boom), raise_server_exceptions=False) as c:
        r = run(c)
    assert r.status_code == 500 and "C:\\" not in r.text and r.json()["error"]["code"] == "internal_error"


def test_ollama_url_must_be_loopback_by_default():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ollama_base_url="http://10.0.0.5:11434")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ollama_base_url="http://169.254.169.254")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ollama_base_url="http://user:pw@127.0.0.1:11434")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ollama_base_url="file:///etc/passwd")
    assert Settings(_env_file=None, ollama_base_url="http://localhost:11434")
    assert Settings(_env_file=None, ollama_base_url="http://10.0.0.5:11434", allow_remote_ollama=True)


def test_host_must_be_loopback_unless_opted_in():
    assert Settings(_env_file=None).host == "127.0.0.1"
    with pytest.raises(ValidationError):
        Settings(_env_file=None, host="0.0.0.0")
    assert Settings(_env_file=None, host="0.0.0.0", allow_non_loopback=True)


def test_invalid_config_values_rejected():
    for kw in ({"target_mode": "docker"}, {"inference_timeout_seconds": 0}, {"environment": "x"},
               {"max_response_chars": 1}, {"ollama_model": "bad model;"}):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **kw)


def test_default_settings_use_mock_mode():
    assert Settings(_env_file=None).target_mode.value == "mock"


def test_worker_token_enforced_when_configured(tmp_path):
    s = Settings(_env_file=None, database_path=str(tmp_path / "w.db"), worker_token="s3cret-token")
    with TestClient(create_app(s)) as c:
        rid = run(c).json()["run_id"]
        url = f"/api/security-tests/runs/{rid}/infrastructure-checks"
        assert c.post(url, json=infra_body(rid)).status_code == 401
        assert c.post(url, json=infra_body(rid), headers={"X-Worker-Token": "wrong"}).status_code == 401
        assert c.post(url, json=infra_body(rid), headers={"X-Worker-Token": "s3cret-token"}).status_code == 201


def test_worker_results_refused_in_production_without_token(tmp_path):
    s = Settings(_env_file=None, database_path=str(tmp_path / "p.db"), environment="production")
    with TestClient(create_app(s)) as c:
        rid = run(c).json()["run_id"]
        r = c.post(f"/api/security-tests/runs/{rid}/infrastructure-checks", json=infra_body(rid))
        assert r.status_code == 503


def test_token_not_in_health_or_repr(tmp_path):
    s = Settings(_env_file=None, database_path=str(tmp_path / "x.db"), worker_token="s3cret-token")
    assert "s3cret-token" not in repr(s)
    with TestClient(create_app(s)) as c:
        assert "s3cret-token" not in c.get("/api/health").text


def test_concurrency_limit_returns_429(tmp_path):
    s = Settings(_env_file=None, database_path=str(tmp_path / "c.db"), max_concurrent_runs=1)
    with TestClient(create_app(s)) as c:
        runner = c.app.state.runner
        assert runner._slots.acquire(blocking=False)  # simulate a run in flight
        try:
            r = run(c)
        finally:
            runner._slots.release()
        assert r.status_code == 429 and r.json()["error"]["code"] == "runner_busy"
        assert run(c).status_code == 200


def test_retention_purges_old_runs(tmp_path):
    from datetime import timedelta
    from app.database import Database
    from app.schemas import RawRunData, RunState, TargetInfo, utc_now
    db = Database(str(tmp_path / "ret.db"))
    db.init()
    old = RawRunData(run_id="run_" + "d" * 32, state=RunState.COMPLETED, test_id="t", test_name="t",
                     test_version="1", expected_behavior="x", created_at=utc_now() - timedelta(days=90),
                     target=TargetInfo(mode="mock", adapter="mock", model="m"))
    db.create_run(old)
    assert db.purge_expired(0) == 0 and db.purge_expired(30) == 1 and db.get_raw(old.run_id) is None
