"""Durable, redacted JSONL audit events for sandbox verification runs."""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_RUN_ID = re.compile(r"^run_[0-9a-f]{32}$")
_SENSITIVE_KEY = re.compile(r"(api.?key|authorization|bearer|password|secret|token|vault|credential)", re.I)
_SENSITIVE_TEXT = re.compile(
    r"(?i)(bearer\s+)[^\s,;]+|((?:api[_-]?key|password|token|secret)\s*[=:]\s*)[^\s,;]+"
)


def _redact(value: Any, key: str = "") -> Any:
    if _SENSITIVE_KEY.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): _redact(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_redact(v) for v in value]
    if isinstance(value, str):
        return _SENSITIVE_TEXT.sub(lambda m: (m.group(1) or m.group(2) or "") + "[REDACTED]", value)[:4000]
    return value


class SandboxAuditLogger:
    """Append-only per-run event writer. Write failures are deliberately not hidden."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def path_for(self, run_id: str) -> Path:
        if not _RUN_ID.fullmatch(run_id):
            raise ValueError("invalid run_id for audit log")
        return self.root / f"run_{run_id[4:]}.jsonl"

    def record(self, run_id: str, stage: str, **fields: Any) -> dict[str, Any]:
        event = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "run_id": run_id,
            "stage": stage,
            **fields,
        }
        safe = _redact(event)
        line = json.dumps(safe, ensure_ascii=True, separators=(",", ":"))
        path = self.path_for(run_id)
        with self._lock:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            with os.fdopen(fd, "a", encoding="utf-8") as stream:
                stream.write(line + "\n")
                stream.flush()
                os.fsync(stream.fileno())
        return safe

    def read(self, run_id: str) -> list[dict[str, Any]]:
        path = self.path_for(run_id)
        if not path.exists():
            return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
