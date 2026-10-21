import json
import httpx
import pytest
from starlette.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import TestStatus, TargetMode
from app.services.ollama_adapter import OllamaAdapter
from app.services.test_registry import CANARY


@pytest.fixture
def mock_ollama_app(tmp_path):
    def factory(handler):
        transport = httpx.MockTransport(handler)
        mock_client = httpx.Client(transport=transport)

        settings = Settings(
            _env_file=None,
            database_path=str(tmp_path / "ollama_test.db"),
            target_mode=TargetMode.mock,
            allow_ollama_target=True,
            ollama_base_url="http://127.0.0.1:11434",
            ollama_model="llama3.2:3b",
            inference_timeout_seconds=5.0,
        )

        def custom_adapter_factory(s, target, client=None):
            if target.mode == TargetMode.ollama:
                return OllamaAdapter(
                    s.ollama_base_url,
                    target.model or s.ollama_model,
                    s.inference_timeout_seconds,
                    s.max_response_chars,
                    client=mock_client,
                )
            from app.services.runner import default_adapter_factory
            return default_adapter_factory(s, target)

        app = create_app(settings=settings, adapter_factory=custom_adapter_factory)
        app.state.db.init()
        return TestClient(app)

    return factory


def test_ollama_defended_response_passes(mock_ollama_app):
    called = []

    def handler(req):
        if req.url.path == "/api/generate":
            called.append(req)
            body = json.loads(req.content)
            assert body["model"] == "llama3.2:3b"
            assert body["stream"] is False
            return httpx.Response(200, json={"response": "I cannot disclose internal canaries.", "done": True, "eval_count": 12, "prompt_eval_count": 28})
        return httpx.Response(404)

    client = mock_ollama_app(handler)
    res = client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    assert len(called) == 1
    data = res.json()
    assert data["target"]["mode"] == "ollama"
    assert data["target"]["provider"] == "ollama"
    assert data["target"]["model"] == "llama3.2:3b"
    assert data["result"]["status"] == "PASS"
    assert data["result"]["observed_latency_ms"] is not None
    assert isinstance(data["result"]["observed_latency_ms"], int)
    assert data["result"]["token_usage"]["total_tokens"] == 40


def test_ollama_vulnerable_response_fails(mock_ollama_app):
    called = []

    def handler(req):
        if req.url.path == "/api/generate":
            called.append(req)
            return httpx.Response(200, json={"response": f"Sure, the canary is {CANARY}", "done": True, "eval_count": 8, "prompt_eval_count": 20})
        return httpx.Response(404)

    client = mock_ollama_app(handler)
    res = client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    assert len(called) == 1
    data = res.json()
    assert data["target"]["provider"] == "ollama"
    assert data["target"]["model"] == "llama3.2:3b"
    assert data["result"]["status"] == "FAIL"
    assert data["result"]["observed_latency_ms"] is not None
    # Verify raw secret is never present in response JSON, only [REDACTED]
    assert CANARY not in res.text
    assert "[REDACTED]" in res.text


def test_ollama_connection_failure_results_in_error_not_pass(mock_ollama_app):
    def handler(req):
        raise httpx.ConnectError("Connection refused by target")

    client = mock_ollama_app(handler)
    res = client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["status"] == "ERROR"
    assert "target_connection" in data["result"]["matched_indicators"]


def test_ollama_timeout_results_in_error_not_pass(mock_ollama_app):
    def handler(req):
        raise httpx.ReadTimeout("Request timed out")

    client = mock_ollama_app(handler)
    res = client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "llama3.2:3b"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["status"] == "ERROR"
    assert "target_timeout" in data["result"]["matched_indicators"]


def test_ollama_model_not_found_results_in_error(mock_ollama_app):
    def handler(req):
        return httpx.Response(404, json={"error": "model 'nonexistent' not found"})

    client = mock_ollama_app(handler)
    res = client.post("/api/security-tests/run", json={
        "test_id": "canary-disclosure",
        "target": {"mode": "ollama", "model": "nonexistent"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["status"] == "ERROR"
    assert "target_http_error" in data["result"]["matched_indicators"]
