"""Lightweight SQLite persistence (parameterised SQL, one connection per operation)."""
from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import uuid
from contextlib import contextmanager
from datetime import timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.schemas import (
    InfraCheckResult,
    InfraStatus,
    InfrastructureSummary,
    RawRunData,
    RunState,
    RunSummary,
    SavedConnectionResponse,
    ModelType,
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

# The seven isolation checks the sandbox worker must report before an aggregate PASS is allowed.
REQUIRED_INFRA_CHECKS = (
    "docker-socket-absence", "non-root-execution", "dropped-capabilities", "resource-limits",
    "workspace-isolation", "host-filesystem-protection", "network-egress",
)

# Worst-first precedence when aggregating infrastructure checks.
_INFRA_PRECEDENCE = [InfraStatus.FAIL, InfraStatus.ERROR, InfraStatus.UNAVAILABLE,
                     InfraStatus.PENDING, InfraStatus.PASS]


class DuplicateInfraResult(Exception):
    pass


class VaultError(Exception):
    """Base exception for credential vault operations."""


class VaultKeyMissingError(VaultError):
    """Raised when an encrypted vault exists but no encryption key is provided."""


class VaultAuthenticationError(VaultError):
    """Raised when vault key is invalid or ciphertext authentication fails."""


class VaultCorruptedError(VaultError):
    """Raised when vault ciphertext is malformed or corrupted."""


class VaultLockedError(VaultError):
    """Raised when attempting to modify a vault that is locked due to missing/invalid key."""


def _set_restrictive_permissions(path: Path) -> None:
    if not path.exists():
        return
    if os.name != "nt":
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
    else:
        try:
            username = os.environ.get("USERNAME")
            if username:
                subprocess.run(
                    ["icacls", str(path), "/inheritance:r", "/grant:r", f"{username}:(F)"],
                    capture_output=True,
                    check=False,
                    timeout=5,
                )
        except Exception:
            pass


def _derive_fernet_key(raw_key: str | bytes) -> bytes:
    """Ensure key is a 32-byte urlsafe base64 string suitable for Fernet."""
    if isinstance(raw_key, str):
        key_bytes = raw_key.strip().encode("utf-8")
    else:
        key_bytes = raw_key.strip()

    try:
        decoded = base64.urlsafe_b64decode(key_bytes)
        if len(decoded) == 32:
            return key_bytes
    except Exception:
        pass

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"safebox-credential-vault-salt-v1",
        iterations=100_000,
    )
    derived = kdf.derive(key_bytes)
    return base64.urlsafe_b64encode(derived)


def _ts(value) -> str:
    """Fixed-width UTC timestamp so lexicographic order equals chronological order."""
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


class Database:
    def __init__(self, path: str, vault_key: str | Any | None = None) -> None:
        self.path = path
        self._explicit_vault_key = vault_key
        self._vault_locked: bool = False
        self._vault_error: str | None = None
        self._secrets_vault: dict[str, str] = {}
        self._load_vault()

    def _vault_file(self) -> Path | None:
        if self.path == ":memory:":
            return None
        return Path(self.path).parent / ".vault.enc"

    def _key_file(self) -> Path | None:
        if self.path == ":memory:":
            return None
        return Path(self.path).parent / ".vault.key"

    def _legacy_vault_file(self) -> Path | None:
        if self.path == ":memory:":
            return None
        return Path(self.path).parent / ".vault.json"

    def _resolve_vault_key(self) -> bytes | None:
        if self._explicit_vault_key:
            val = self._explicit_vault_key
            if hasattr(val, "get_secret_value"):
                val = val.get_secret_value()
            if val and str(val).strip():
                return _derive_fernet_key(val)

        env_key = os.environ.get("SAFEBOX_VAULT_KEY")
        if env_key and env_key.strip():
            return _derive_fernet_key(env_key)

        kf = self._key_file()
        if kf and kf.exists():
            try:
                key_text = kf.read_text(encoding="utf-8").strip()
                if key_text:
                    return _derive_fernet_key(key_text)
            except Exception as exc:
                logging.getLogger("safebox.db").error(
                    "Could not read vault key file (%s).", type(exc).__name__
                )

        vf = self._vault_file()
        if vf and vf.exists():
            return None

        new_key = Fernet.generate_key()
        if kf:
            try:
                kf.parent.mkdir(parents=True, exist_ok=True)
                tmp_k = kf.with_name(kf.name + ".tmp")
                fd = os.open(tmp_k, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(fd, "wb") as fh:
                    fh.write(new_key)
                _set_restrictive_permissions(tmp_k)
                os.replace(tmp_k, kf)
                _set_restrictive_permissions(kf)
            except Exception as exc:
                logging.getLogger("safebox.db").error(
                    "Could not persist generated vault key (%s).", type(exc).__name__
                )
        return new_key

    def _load_vault(self) -> None:
        vf = self._vault_file()
        legacy_vf = self._legacy_vault_file()
        if not vf:
            return

        key = self._resolve_vault_key()

        # Step 1: Encrypted vault exists (.vault.enc)
        if vf.exists():
            if not key:
                self._vault_locked = True
                self._vault_error = "key_missing"
                logging.getLogger("safebox.db").error(
                    "Credential vault key is missing; cannot decrypt existing vault."
                )
                return

            try:
                raw_bytes = vf.read_bytes()
                fernet = Fernet(key)
                decrypted = fernet.decrypt(raw_bytes)
                data = json.loads(decrypted.decode("utf-8"))
                if isinstance(data, dict):
                    self._secrets_vault = data
                self._vault_locked = False
                self._vault_error = None
            except InvalidToken:
                self._vault_locked = True
                self._vault_error = "authentication_failed"
                logging.getLogger("safebox.db").error(
                    "Credential vault decryption failed: invalid key or corrupted ciphertext."
                )
            except Exception as exc:
                self._vault_locked = True
                self._vault_error = "corrupted_ciphertext"
                logging.getLogger("safebox.db").error(
                    "Could not load credential vault (%s).", type(exc).__name__
                )
            return

        # Step 2: If .vault.enc does not exist, check for legacy .vault.json
        if legacy_vf and legacy_vf.exists():
            try:
                raw_text = legacy_vf.read_text(encoding="utf-8").strip()
                if not raw_text:
                    return

                if not key:
                    self._vault_locked = True
                    self._vault_error = "key_missing"
                    logging.getLogger("safebox.db").error(
                        "Cannot migrate legacy credential vault: encryption key is missing."
                    )
                    return

                if raw_text.startswith("{") and raw_text.endswith("}"):
                    data = json.loads(raw_text)
                    if isinstance(data, dict):
                        self._secrets_vault = data
                        self._vault_locked = False
                        self._vault_error = None
                        self._save_vault()
                        vf_bytes = vf.read_bytes()
                        verify_data = json.loads(Fernet(key).decrypt(vf_bytes).decode("utf-8"))
                        if verify_data == data:
                            bak_path = legacy_vf.with_name(legacy_vf.name + ".bak")
                            shutil.copy2(legacy_vf, bak_path)
                            _set_restrictive_permissions(bak_path)
                            legacy_vf.unlink(missing_ok=True)
                            logging.getLogger("safebox.db").info(
                                "Migrated legacy plaintext vault to encrypted vault. Backup preserved at %s.",
                                bak_path.name,
                            )
                else:
                    decrypted = Fernet(key).decrypt(raw_text.encode("utf-8"))
                    data = json.loads(decrypted.decode("utf-8"))
                    if isinstance(data, dict):
                        self._secrets_vault = data
                        self._save_vault()
                        legacy_vf.unlink(missing_ok=True)
            except Exception as exc:
                self._vault_locked = True
                self._vault_error = "migration_failed"
                logging.getLogger("safebox.db").error(
                    "Could not migrate legacy credential vault (%s).", type(exc).__name__
                )

    def _save_vault(self) -> None:
        vf = self._vault_file()
        if not vf:
            return

        if self._vault_locked:
            raise VaultLockedError(
                f"Credential vault is locked ({self._vault_error}); cannot modify or save credentials."
            )

        key = self._resolve_vault_key()
        if not key:
            raise VaultKeyMissingError("Cannot save credentials: vault encryption key is missing.")

        tmp: Path | None = None
        try:
            vf.parent.mkdir(parents=True, exist_ok=True)
            tmp = vf.with_name(vf.name + ".tmp")
            fernet = Fernet(key)
            payload = json.dumps(self._secrets_vault).encode("utf-8")
            ciphertext = fernet.encrypt(payload)

            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as fh:
                fh.write(ciphertext)

            _set_restrictive_permissions(tmp)
            os.replace(tmp, vf)
            _set_restrictive_permissions(vf)
        except Exception as exc:  # noqa: BLE001
            logging.getLogger("safebox.db").error(
                "Could not persist the credential vault (%s); saved API keys will not survive a restart.",
                type(exc).__name__,
            )
            if tmp and tmp.exists():
                try:
                    tmp.unlink()
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
                try:
                    c.execute("PRAGMA journal_mode=WAL")
                except Exception:
                    pass
        with self._conn() as c:
            c.executescript(_SCHEMA)
        self.recover_orphaned_runs()

    def recover_orphaned_runs(self) -> int:
        """Scan for orphaned RUNNING runs from an ungraceful shutdown/crash and mark them ABORTED with status ERROR."""
        with self._conn() as c:
            rows = c.execute("SELECT raw_json FROM runs WHERE state = 'RUNNING'").fetchall()
            recovered = 0
            for (raw_str,) in rows:
                try:
                    raw = RawRunData.model_validate_json(raw_str)
                    raw.state = RunState.ABORTED
                    raw.status = TestStatus.ERROR
                    raw.explanation = "Run aborted by unexpected server termination; no verdict was reached."
                    raw.matched_indicators = ["internal_error", "server_termination"]
                    raw.completed_at = utc_now()
                    c.execute(
                        "UPDATE runs SET state = ?, status = ?, completed_at = ?, raw_json = ? WHERE run_id = ?",
                        (raw.state.value, raw.status.value, _ts(raw.completed_at), raw.model_dump_json(), raw.run_id),
                    )
                    recovered += 1
                except Exception:
                    pass
            return recovered

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

    def delete_infra_check(self, run_id: str, worker_id: str, check_id: str) -> int:
        """Remove one result when its required audit write could not be completed."""
        with self._conn() as c:
            cur = c.execute(
                "DELETE FROM infra_checks WHERE run_id = ? AND worker_id = ? AND check_id = ?",
                (run_id, worker_id, check_id),
            )
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
        if status == InfraStatus.PASS:
            # Never claim isolation is verified from a subset of the required checks,
            # and require that all checks originate from a single consistent worker.
            workers = {c.worker_id for c in checks}
            worker_has_all = any(
                all(req in {c.check_id for c in checks if c.worker_id == w and c.status == InfraStatus.PASS}
                    for req in REQUIRED_INFRA_CHECKS)
                for w in workers
            )
            if not worker_has_all:
                reported = {c.check_id for c in checks}
                missing = [i for i in REQUIRED_INFRA_CHECKS if i not in reported]
                if missing:
                    got = len(REQUIRED_INFRA_CHECKS) - len(missing)
                    return InfrastructureSummary(
                        status=InfraStatus.PENDING, checks=checks,
                        note=(f"Incomplete: {got} of {len(REQUIRED_INFRA_CHECKS)} required isolation checks "
                              f"reported (missing: {', '.join(missing)}). PASS requires all of them."))
                else:
                    return InfrastructureSummary(
                        status=InfraStatus.PENDING, checks=checks,
                        note="Incomplete: required isolation checks are split across multiple workers. PASS requires all checks from a single worker.")
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
        model_type: ModelType | str = ModelType.chat,
    ) -> SavedConnectionResponse:
        conn_id = connection_id or f"conn_{uuid.uuid4().hex[:16]}"
        now = utc_now()
        now_str = _ts(now)

        existing_row = None
        if connection_id:
            with self._conn() as c:
                existing_row = c.execute(
                    "SELECT has_api_key, masked_api_key, created_at FROM connections WHERE connection_id = ?",
                    (conn_id,),
                ).fetchone()

        if api_key and api_key.strip():
            clean_key = api_key.strip()
            has_key = 1
            masked_key = (
                f"{clean_key[:3]}...{clean_key[-3:]}"
                if len(clean_key) > 6
                else "••••••••"
            )
            if self._vault_locked:
                raise VaultLockedError(
                    f"Credential vault is locked ({self._vault_error}); cannot modify credentials."
                )
            self._secrets_vault[conn_id] = clean_key
            self._save_vault()
        elif existing_row and existing_row[0]:
            has_key = existing_row[0]
            masked_key = existing_row[1] or "••••••••"
        elif conn_id in self._secrets_vault and self._secrets_vault[conn_id]:
            stored = self._secrets_vault[conn_id]
            has_key = 1
            masked_key = (
                f"{stored[:3]}...{stored[-3:]}"
                if len(stored) > 6
                else "••••••••"
            )
        else:
            has_key = 0
            masked_key = None

        config_data = {
            "custom_headers": custom_headers,
            "request_template": request_template,
            "response_path": response_path,
            "model_type": model_type.value if isinstance(model_type, ModelType) else model_type,
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

        created_ts = existing_row[2] if existing_row and existing_row[2] else now

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
            model_type=model_type,
            created_at=created_ts,
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
            "model_type": cfg.get("model_type", ModelType.chat.value),
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
                    model_type=cfg.get("model_type", ModelType.chat.value),
                    created_at=created_at,
                    updated_at=updated_at,
                )
            )
        return result

    def delete_connection(self, connection_id: str) -> bool:
        if self._vault_locked:
            raise VaultLockedError(
                f"Credential vault is locked ({self._vault_error}); cannot modify credentials."
            )
        self._secrets_vault.pop(connection_id, None)
        self._save_vault()
        with self._conn() as c:
            cur = c.execute("DELETE FROM connections WHERE connection_id = ?", (connection_id,))
            return cur.rowcount > 0
