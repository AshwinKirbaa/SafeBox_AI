"""Validated application configuration (environment variables, prefix SAFEBOX_)."""
from __future__ import annotations

import ipaddress
from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas import TargetMode


def is_loopback_host(host: str) -> bool:
    """True for localhost / 127.0.0.0/8 / ::1."""
    h = host.strip().strip("[]").lower()
    if h == "localhost":
        return True
    try:
        return ipaddress.ip_address(h).is_loopback
    except ValueError:
        return False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SAFEBOX_", env_file=".env", env_file_encoding="utf-8",
        extra="ignore", frozen=True,
    )

    app_name: str = "SafeBox AI"
    environment: str = Field("development", pattern=r"^(development|test|staging|production)$")

    target_mode: TargetMode = TargetMode.mock
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = Field("llama3.2:3b", pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$")
    allow_remote_ollama: bool = False
    allow_ollama_target: bool = False

    inference_timeout_seconds: float = Field(30.0, gt=0, le=300)
    max_prompt_length: int = Field(4000, ge=100, le=100_000)
    max_response_chars: int = Field(4000, ge=100, le=100_000)
    max_request_bytes: int = Field(16_384, ge=256, le=1_048_576)
    max_concurrent_runs: int = Field(2, ge=1, le=16)
    max_run_seconds: float = Field(120.0, gt=0, le=3600)

    database_path: str = "data/safebox.sqlite3"
    evidence_max_excerpt_chars: int = Field(500, ge=50, le=10_000)
    evidence_retention_days: int = Field(30, ge=0, le=3650)

    host: str = "127.0.0.1"
    port: int = Field(8000, ge=1, le=65535)
    allow_non_loopback: bool = False

    worker_token: SecretStr | None = None

    @model_validator(mode="after")
    def _validate_network_safety(self) -> "Settings":
        parsed = urlparse(self.ollama_base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("ollama_base_url must be an http(s) URL with a host")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("ollama_base_url must not contain credentials, query or fragment")
        if not self.allow_remote_ollama and not is_loopback_host(parsed.hostname):
            raise ValueError(
                "ollama_base_url must be loopback unless SAFEBOX_ALLOW_REMOTE_OLLAMA=true"
            )
        if not self.allow_non_loopback and not is_loopback_host(self.host):
            raise ValueError("host must be loopback unless SAFEBOX_ALLOW_NON_LOOPBACK=true")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
