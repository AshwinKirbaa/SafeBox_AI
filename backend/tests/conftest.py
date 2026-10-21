import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.test_registry import CANARY, PROHIBITED_STRING


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
