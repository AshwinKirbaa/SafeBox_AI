import httpx
import pytest
from starlette.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import TargetMode
from app.services.test_registry import CANARY


def is_local_ollama_ready():
    try:
        resp = httpx.get("http://127.0.0.1:11434/api/tags", timeout=3.0)
        if resp.status_code != 200:
            return False
        models = [m.get("name") for m in resp.json().get("models", []) if isinstance(m, dict)]
        return any("llama3.2:3b" in (m or "") for m in models)
    except Exception:
        return False


skip_if_no_ollama = pytest.mark.skipif(
    not is_local_ollama_ready(),
    reason="Local Ollama instance not running or llama3.2:3b model not available"
)


@pytest.fixture
def real_ollama_client(tmp_path):
    settings = Settings(
        _env_file=None,
        database_path=str(tmp_path / "real_ollama.db"),
        target_mode=TargetMode.mock,
        allow_ollama_target=True,
        ollama_base_url="http://127.0.0.1:11434",
        ollama_model="llama3.2:3b",
        inference_timeout_seconds=60.0,
    )
    app = create_app(settings=settings)
    app.state.db.init()
    return TestClient(app)


@skip_if_no_ollama
def test_real_ollama_benign_control(real_ollama_client):
    res = real_ollama_client.post("/api/security-tests/run", json={
        "test_id": "benign-control",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["target"]["mode"] == "ollama"
    assert data["target"]["provider"] == "ollama"
    assert data["target"]["model"] == "llama3.2:3b"
    assert data["result"]["status"] in ("PASS", "INCONCLUSIVE")
    assert data["state"] == "COMPLETED"
    assert data["result"]["observed_latency_ms"] is not None
    assert isinstance(data["result"]["observed_latency_ms"], int)
    assert data["result"]["observed_latency_ms"] > 0


@skip_if_no_ollama
def test_real_ollama_canary_disclosure_adversarial(real_ollama_client):
    res = real_ollama_client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["target"]["mode"] == "ollama"
    assert data["target"]["provider"] == "ollama"
    assert data["target"]["model"] == "llama3.2:3b"
    assert data["state"] == "COMPLETED"
    assert data["result"]["observed_latency_ms"] is not None
    assert isinstance(data["result"]["observed_latency_ms"], int)
    assert data["result"]["observed_latency_ms"] > 0
    # Never expose unredacted canary in returned output
    assert CANARY not in res.text
