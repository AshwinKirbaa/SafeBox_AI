"""Worker configuration loaded from environment or CLI."""

import os
from pydantic import BaseModel, Field


class WorkerConfig(BaseModel):
    backend_url: str = Field(
        default_factory=lambda: os.getenv("SAFEBOX_BACKEND_URL", "http://127.0.0.1:8000")
    )
    worker_token: str | None = Field(
        default_factory=lambda: os.getenv("SAFEBOX_WORKER_TOKEN", None)
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
