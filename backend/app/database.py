"""Lightweight SQLite persistence (parameterised SQL, one connection per operation)."""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from app.schemas import (
    InfraCheckResult,
    InfraStatus,
    InfrastructureSummary,
    RawRunData,
    RunState,
    RunSummary,
    SavedConnectionResponse,
    TestStatus,
    utc_now,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    test_id TEXT NOT NULL,
    test_version TEXT NOT NULL,
    state TEXT NOT NULL,
    status TEXT,
    target_mode TEXT NOT NULL,
    raw_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);
CREATE TABLE IF NOT EXISTS infra_checks (
    run_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    check_id TEXT NOT NULL,
    received_at TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY (run_id, worker_id, check_id)
);
CREATE TABLE IF NOT EXISTS connections (
    connection_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    base_url TEXT,
    has_api_key INTEGER NOT NULL DEFAULT 0,
    masked_api_key TEXT,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

# Worst-first precedence when aggregating infrastructure checks.
_INFRA_PRECEDENCE = [InfraStatus.FAIL, InfraStatus.ERROR, InfraStatus.UNAVAILABLE,
                     InfraStatus.PENDING, InfraStatus.PASS]


class DuplicateInfraResult(Exception):
    pass


def _ts(value) -> str:
    """Fixed-width UTC timestamp so lexicographic order equals chronological order."""
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


class Database:
    def __init__(self, path: str) -> None:
        self.path = path
        # Secure credential vault (persisted locally in protected file, never plaintext in SQLite)
        self._secrets_vault: dict[str, str] = {}
        self._load_vault()

    def _vault_file(self) -> Path | None:
        if self.path == ":memory:":
            return None
        return Path(self.path).parent / ".vault.json"

    def _load_vault(self) -> None:
        vf = self._vault_file()
        if vf and vf.exists():
            try:
                data = json.loads(vf.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    self._secrets_vault.update(data)
            except Exception:
                pass

    def _save_vault(self) -> None:
        vf = self._vault_file()
        if vf:
            try:
                vf.parent.mkdir(parents=True, exist_ok=True)
                vf.write_text(json.dumps(self._secrets_vault), encoding="utf-8")
            except Exception:
                pass

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            with conn:  # commit / rollback
                yield conn
        finally:
            conn.close()

    def init(self) -> None:
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(_SCHEMA)

    def ping(self) -> bool:
        try:
            with self._conn() as c:
                c.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:
            return False

    # -- runs ----------------------------------------------------------------------
    def create_run(self, raw: RawRunData) -> None:
        self._write_run(raw, insert=True)

    def save_run(self, raw: RawRunData) -> None:
        self._write_run(raw, insert=False)

    def _write_run(self, raw: RawRunData, insert: bool) -> None:
        mode_val = raw.target.mode.value if hasattr(raw.target.mode, "value") else str(raw.target.mode)
        values = (
            _ts(raw.created_at), _ts(raw.completed_at) if raw.completed_at else None,
            raw.test_id, raw.test_version, raw.state.value,
            raw.status.value if raw.status else None, mode_val,
            raw.model_dump_json(),
        )
        with self._conn() as c:
            if insert:
                c.execute(
                    "INSERT INTO runs (created_at, completed_at, test_id, test_version, state, "
                    "status, target_mode, raw_json, run_id) VALUES (?,?,?,?,?,?,?,?,?)",
                    (*values, raw.run_id))
            else:
                c.execute(
                    "UPDATE runs SET created_at=?, completed_at=?, test_id=?, test_version=?, "
                    "state=?, status=?, target_mode=?, raw_json=? WHERE run_id=?",
                    (*values, raw.run_id))

    def get_raw(self, run_id: str) -> RawRunData | None:
        with self._conn() as c:
            row = c.execute("SELECT raw_json FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        return RawRunData.model_validate_json(row[0]) if row else None

    def list_runs(
        self,
        limit: int,
        offset: int,
        provider: str | None = None,
        model: str | None = None,
        status: str | None = None,
    ) -> tuple[list[RunSummary], int]:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
        with self._conn() as c:
            rows = c.execute(
                "SELECT run_id, state, test_id, test_version, status, target_mode, created_at, "
                "completed_at, raw_json FROM runs ORDER BY created_at DESC, run_id DESC"
            ).fetchall()

        all_items: list[RunSummary] = []
        for r in rows:
            run_id, state_str, test_id, test_ver, status_str, target_mode, created_at, comp_at, raw_json = r
            prov = target_mode
            mod = None
            try:
                parsed_raw = json.loads(raw_json)
                target_obj = parsed_raw.get("target", {})
                prov = target_obj.get("provider") or target_mode
                mod = target_obj.get("model")
            except Exception:
                pass

            if provider and prov.lower() != provider.lower():
                continue
            if model and mod and model.lower() not in mod.lower():
                continue
            if status and (not status_str or status_str.upper() != status.upper()):
                continue

            all_items.append(
                RunSummary(
                    run_id=run_id,
                    state=RunState(state_str),
                    test_id=test_id,
                    test_version=test_ver,
                    status=TestStatus(status_str) if status_str else None,
                    target_mode=target_mode,
                    provider=prov,
                    model=mod,
                    created_at=created_at,
                    completed_at=comp_at,
                )
            )

        total = len(all_items)
        items = all_items[offset : offset + limit]
        return items, total

    def purge_expired(self, retention_days: int) -> int:
        """Delete runs (and their infra checks) older than the retention window. 0 = keep all."""
        if retention_days <= 0:
            return 0
        cutoff = _ts(utc_now() - timedelta(days=retention_days))
        with self._conn() as c:
            old = [r[0] for r in c.execute("SELECT run_id FROM runs WHERE created_at < ?", (cutoff,))]
            for rid in old:
                c.execute("DELETE FROM infra_checks WHERE run_id = ?", (rid,))
                c.execute("DELETE FROM runs WHERE run_id = ?", (rid,))
        return len(old)

    # -- infrastructure checks (supplied by Member 2's worker) ------------------------
    def add_infra_check(self, result: InfraCheckResult) -> None:
        try:
            with self._conn() as c:
                c.execute(
                    "INSERT INTO infra_checks (run_id, worker_id, check_id, received_at, status, "
                    "result_json) VALUES (?,?,?,?,?,?)",
                    (result.run_id, result.worker_id, result.check_id,
                     _ts(result.received_at), result.status.value, result.model_dump_json()))
        except sqlite3.IntegrityError as exc:
            raise DuplicateInfraResult from exc

    def clear_infra_checks(self, run_id: str) -> int:
        with self._conn() as c:
            cur = c.execute("DELETE FROM infra_checks WHERE run_id = ?", (run_id,))
            return cur.rowcount

    def infra_summary(self, run_id: str) -> InfrastructureSummary:
        with self._conn() as c:
            rows = c.execute(
                "SELECT result_json FROM infra_checks WHERE run_id = ? ORDER BY received_at, check_id",
                (run_id,)).fetchall()
        checks = [InfraCheckResult.model_validate_json(r[0]) for r in rows]
        if not checks:
            return InfrastructureSummary(status=InfraStatus.MISSING, checks=[])
        present = {c.status for c in checks}
        status = next(s for s in _INFRA_PRECEDENCE if s in present)
        return InfrastructureSummary(status=status, checks=checks)

    # -- model connections management ----------------------------------------------
    def save_connection(
        self,
        name: str,
        provider: str,
        model: str,
        base_url: str | None = None,
        api_key: str | None = None,
        custom_headers: dict[str, str] | None = None,
        request_template: dict[str, Any] | None = None,
        response_path: str | None = None,
        connection_id: str | None = None,
    ) -> SavedConnectionResponse:
        conn_id = connection_id or f"conn_{uuid.uuid4().hex[:16]}"
        now = utc_now()
        now_str = _ts(now)

        has_key = 1 if api_key else 0
        masked_key = f"{api_key[:3]}...{api_key[-3:]}" if api_key and len(api_key) > 6 else ("••••••••" if api_key else None)

        if api_key:
            self._secrets_vault[conn_id] = api_key
            self._save_vault()

        config_data = {
            "custom_headers": custom_headers,
            "request_template": request_template,
            "response_path": response_path,
        }

        with self._conn() as c:
            c.execute(
                "INSERT INTO connections (connection_id, name, provider, model, base_url, "
                "has_api_key, masked_api_key, config_json, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(connection_id) DO UPDATE SET "
                "name=excluded.name, provider=excluded.provider, model=excluded.model, "
                "base_url=excluded.base_url, has_api_key=excluded.has_api_key, "
                "masked_api_key=excluded.masked_api_key, config_json=excluded.config_json, "
                "updated_at=excluded.updated_at",
                (conn_id, name, provider, model, base_url, has_key, masked_key,
                 json.dumps(config_data), now_str, now_str),
            )

        return SavedConnectionResponse(
            connection_id=conn_id,
            name=name,
            provider=provider,
            model=model,
            base_url=base_url,
            has_api_key=bool(has_key),
            masked_api_key=masked_key,
            custom_headers=custom_headers,
            request_template=request_template,
            response_path=response_path,
            created_at=now,
            updated_at=now,
        )

    def get_connection(self, connection_id: str) -> dict[str, Any] | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT connection_id, name, provider, model, base_url, has_api_key, "
                "masked_api_key, config_json, created_at, updated_at FROM connections WHERE connection_id = ?",
                (connection_id,),
            ).fetchone()
        if not row:
            return None

        conn_id, name, provider, model, base_url, has_key, masked_key, cfg_str, created_at, updated_at = row
        cfg = json.loads(cfg_str) if cfg_str else {}

        # Resolve api_key from in-memory vault, environment variables, or local .env
        secret = self._secrets_vault.get(conn_id)
        if not secret:
            self._load_vault()
            secret = self._secrets_vault.get(conn_id)
        if not secret:
            from app.services.adapter_registry import resolve_api_key
            secret = resolve_api_key(provider)

        return {
            "connection_id": conn_id,
            "name": name,
            "provider": provider,
            "model": model,
            "base_url": base_url,
            "has_api_key": bool(has_key or secret),
            "masked_api_key": masked_key,
            "api_key": secret,
            "custom_headers": cfg.get("custom_headers"),
            "request_template": cfg.get("request_template"),
            "response_path": cfg.get("response_path"),
            "created_at": created_at,
            "updated_at": updated_at,
        }

    def list_connections(self) -> list[SavedConnectionResponse]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT connection_id, name, provider, model, base_url, has_api_key, "
                "masked_api_key, config_json, created_at, updated_at FROM connections ORDER BY updated_at DESC"
            ).fetchall()

        result = []
        for r in rows:
            conn_id, name, provider, model, base_url, has_key, masked_key, cfg_str, created_at, updated_at = r
            cfg = json.loads(cfg_str) if cfg_str else {}
            result.append(
                SavedConnectionResponse(
                    connection_id=conn_id,
                    name=name,
                    provider=provider,
                    model=model,
                    base_url=base_url,
                    has_api_key=bool(has_key),
                    masked_api_key=masked_key,
                    custom_headers=cfg.get("custom_headers"),
                    request_template=cfg.get("request_template"),
                    response_path=cfg.get("response_path"),
                    created_at=created_at,
                    updated_at=updated_at,
                )
            )
        return result

    def delete_connection(self, connection_id: str) -> bool:
        self._secrets_vault.pop(connection_id, None)
        self._save_vault()
        with self._conn() as c:
            cur = c.execute("DELETE FROM connections WHERE connection_id = ?", (connection_id,))
            return cur.rowcount > 0
