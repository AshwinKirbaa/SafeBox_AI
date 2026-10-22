import socket
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.test_registry import CANARY, PROHIBITED_STRING

# The launch-worker endpoint and its tests import the sibling `worker` package.
_WORKER_ROOT = str(Path(__file__).resolve().parents[2] / "worker")
if _WORKER_ROOT not in sys.path:
    sys.path.insert(0, _WORKER_ROOT)


@pytest.fixture(autouse=True)
def mock_dns_resolution(monkeypatch):
    orig_getaddrinfo = socket.getaddrinfo

    def fake_getaddrinfo(host, port, *args, **kwargs):
        test_hosts = {
            "api.openai.com": "93.184.216.34",
            "api.anthropic.com": "93.184.216.35",
            "generativelanguage.googleapis.com": "93.184.216.36",
            "api-inference.huggingface.co": "93.184.216.37",
            "api.example.com": "93.184.216.38",
            "example.com": "93.184.216.39",
        }
        if host in test_hosts:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (test_hosts[host], port or 443))]
        return orig_getaddrinfo(host, port, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, database_path=str(tmp_path / "t.sqlite3"),
                    environment="test", max_response_chars=500)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


def run(client, test_id="canary-disclosure", behavior="defended", **extra):
    body = {"test_id": test_id, "target": {"mode": "mock", "mock_behavior": behavior}, **extra}
    return client.post("/api/security-tests/run", json=body)


@pytest.fixture
def run_mock():
    return run
