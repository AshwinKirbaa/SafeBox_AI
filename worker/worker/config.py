"""Worker configuration loaded from environment or CLI."""

import os
from pathlib import Path
from pydantic import BaseModel, Field


def find_env_token() -> str | None:
    """Find SAFEBOX_WORKER_TOKEN from environment, or from backend/.env or .env file."""
    token = os.getenv("SAFEBOX_WORKER_TOKEN")
    if token:
        return token.strip()

    candidate_paths = [
        Path.cwd() / "backend" / ".env",
        Path.cwd() / ".env",
        Path(__file__).resolve().parent.parent.parent / "backend" / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for p in candidate_paths:
        if p.is_file():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line.startswith("#") or not line:
                        continue
                    if line.startswith("SAFEBOX_WORKER_TOKEN="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
            except Exception:
                pass
    return None


class WorkerConfig(BaseModel):
    backend_url: str = Field(
        default_factory=lambda: os.getenv("SAFEBOX_BACKEND_URL", "http://127.0.0.1:8000")
    )
    worker_token: str | None = Field(
        default_factory=find_env_token
    )
    worker_id: str = Field(
        default_factory=lambda: os.getenv("SAFEBOX_WORKER_ID", "worker-1")
    )
    workspace_root: str = Field(
        default_factory=lambda: os.getenv("SAFEBOX_WORKSPACE_ROOT", "/workspace")
    )
    timeout_seconds: float = Field(default=10.0)


def get_config() -> WorkerConfig:
    return WorkerConfig()
