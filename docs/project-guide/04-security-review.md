# SafeBox AI — Security Review

> **Document series:** `docs/project-guide/`
> This file: `04-security-review.md` — Verified controls, known limitations, and attack surfaces.

---

## Security Architecture Summary

SafeBox AI is designed with multiple independent layers of defence. Each layer is documented with its actual implementation status.

---

## 1. Credential Vault Encryption (SEC-01)

**Status: IMPLEMENTED — verified in code**

### How it works

API keys are never written to SQLite. The vault is a separate file: `.vault.enc` (Fernet AES-128-CBC + HMAC-SHA256).

**Key resolution order** (first non-empty wins):
1. Explicit `vault_key` argument to `Database()` (set from `Settings.vault_key` / `SAFEBOX_VAULT_KEY` env)
2. `SAFEBOX_VAULT_KEY` environment variable
3. `.vault.key` file on disk (auto-created with `chmod 600` on first start)
4. Auto-generated `Fernet.generate_key()` written to `.vault.key`

**Failure modes (all safe):**
- Encrypted vault exists but no key: `VaultKeyMissingError` — vault locked, reads fail gracefully
- Wrong key: `InvalidToken` → `VaultAuthenticationError` — vault locked
- Corrupted ciphertext: `VaultCorruptedError` — vault locked
- Locked vault: `VaultLockedError` raised on any write attempt

**Migration path**: legacy `.vault.json` (plaintext) auto-migrated on first access. Backup saved as `.vault.json.bak` before deletion. Verified by round-trip decrypt before deleting original.

**File permissions**: atomic write via `.vault.enc.tmp` → `os.replace()`. Both files get `chmod 600` (POSIX) or `icacls` restricted ACL (Windows).

**Key derivation**: if raw key is not a valid 32-byte urlsafe-base64 Fernet key, PBKDF2-HMAC-SHA256 is applied (100,000 iterations, fixed salt `safebox-credential-vault-salt-v1`) to produce a compatible key.

### Limitations (known, not mitigated)
- PBKDF2 salt is not per-installation random (fixed constant). An attacker with physical access to the key file does not benefit from PBKDF2 since the key is already stored.
- No key rotation mechanism. Rotating requires manually re-encrypting the vault.
- In-memory vault (`self._secrets_vault`) is a plain Python dict — not zeroed on deallocation. This is a Python ecosystem limitation.

---

## 2. Input Validation and API Surface

**Status: IMPLEMENTED — verified**

All request bodies use `StrictModel(BaseModel)` with `extra="forbid"`. Unknown fields return 422.

### Validated Patterns

| Field | Constraint | Purpose |
|---|---|---|
| `run_id` | `^run_[0-9a-f]{32}$` | Prevents path traversal; accepted by URL path and body |
| `test_id` | `^[a-z0-9][a-z0-9-]{1,63}$` | Registry key; no injection |
| `connection_id` | `^conn_[0-9a-f]{16,32}$` | DB key |
| `check_id`, `worker_id` | `^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$` (max 128) | Worker fields |
| `model` | `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$` | Model name |
| `environment` | `^(development\|test\|staging\|production)$` | Enum-only |
| `ollama_base_url` | Must be loopback http(s) without credentials | SSRF guard |
| `host` | Must be loopback | Network exposure guard |

### Request Size Limit
Middleware rejects bodies exceeding `SAFEBOX_MAX_REQUEST_BYTES` (default 16,384 bytes) with 413. Chunked transfer without Content-Length gets 411.

### Error Leakage Prevention
- Validation errors (422): only `loc`, `msg`, `type` — never echo submitted values.
- 500 errors: only generic "Internal server error." — no stack traces.
- All unhandled exceptions: logged as `type=<ClassName>` (no message that could contain user input).

---

## 3. SSRF Protection

**Status: IMPLEMENTED — verified**

`Settings._validate_network_safety()`:
1. `ollama_base_url` must be `http://` or `https://` with a valid hostname.
2. No username, password, query string, or fragment allowed.
3. Hostname must be loopback (`127.0.0.0/8` or `::1`) unless `SAFEBOX_ALLOW_REMOTE_OLLAMA=true`.

`config.is_loopback_host()` handles `localhost`, `127.x.x.x`, and `::1`.

**Limitation**: `SAFEBOX_ALLOW_REMOTE_OLLAMA=true` completely bypasses this guard — use only in a trusted network. The setting exists for legitimate local-LAN setups.

---

## 4. Worker Authentication

**Status: IMPLEMENTED — verified**

`POST /api/security-tests/runs/{run_id}/infrastructure-checks` requires `X-Worker-Token` header when `SAFEBOX_WORKER_TOKEN` is set.

```python
hmac.compare_digest(token.encode(), expected.encode())
```

Timing-safe comparison prevents timing oracle attacks.

**Enforcement by environment:**
- `development` / `test`: worker token optional (open for local testing)
- `staging` / `production`: worker token **mandatory** — 503 returned if not configured

**Limitation**: The worker token is a shared secret (no per-worker identity, no certificate-based auth). This is appropriate for single-host deployment but insufficient for multi-host distributed workers.

---

## 5. Docker Worker Isolation

**Status: IMPLEMENTED — verified against code and Docker arguments**

### Container Hardening (verified in `build_docker_run_args()`)

| Flag | Value | Security effect |
|---|---|---|
| `--user` | `10001:10001` | Non-root UID and GID |
| `--security-opt` | `no-new-privileges:true` | Prevents privilege escalation via setuid |
| `--cap-drop` | `ALL` | All Linux capabilities removed |
| `--read-only` | — | Root filesystem is read-only |
| `--tmpfs /tmp` | `rw,noexec,nosuid,size=64m` | Isolated writable scratch space |
| `--memory` | `256m` | Memory limit |
| `--memory-swap` | `256m` | No swap (memory-swap == memory) |
| `--cpus` | `0.5` | CPU throttle |
| `--pids-limit` | `64` | PID count limit (fork-bomb protection) |
| `--network` | `none` | No network interfaces |
| `-v` | `{run_workspace}:/workspace:rw` | Only designated workspace mounted |

### Path Traversal Prevention

- `run_id` validated with `RUN_ID_REGEX = re.compile(r"^run_[0-9a-f]{16,32}$")`.
- After `Path.resolve()`, workspace path is checked with `.relative_to(base_resolved)`.
- Planted symlinks at workspace path rejected: `if run_workspace.is_symlink(): raise RuntimeError`.
- Sentinel file created with `O_CREAT | O_EXCL | O_NOFOLLOW` (atomically, no symlink follow).

### Host-Container Dual Verification

For `workspace-isolation`:
1. Container verifies its workspace is writable and adjacent workspaces are inaccessible.
2. Host verifies: exactly one bind-mount, mount targets `/workspace:rw`, mount source resolves to current run workspace, adjacent workspace NOT mounted.
3. Container `PASS` is only confirmed to `PASS` if host verification also passes.
4. Container `INCONCLUSIVE` is **never upgraded** by the host — retained as `INCONCLUSIVE`.
5. Container `FAIL` is always preserved (host may not downgrade a detected breach).

### Host Fallback Mode

When Docker is unavailable, checks that require container context (`dropped-capabilities`, `resource-limits`) report `UNAVAILABLE`. Checks that would naively report `PASS` on the host also report `UNAVAILABLE` with the message "Docker unavailable on host; container isolation not verified."

### Negative Test Coverage

38 automated negative tests in `worker/tests/test_isolation_negative.py` verify that the checks reject:
- Docker socket exposure
- Root UID/GID execution
- Non-zero effective capabilities
- Missing or excessive memory/PID limits
- Cross-workspace access
- Prohibited host filesystem mounts
- Enabled network egress

---

## 6. SQLite Integrity

**Status: IMPLEMENTED — no ORM, parameterised SQL**

All SQL uses `sqlite3.connect()` with parameterised queries (`?` placeholders). No string interpolation in SQL.

`UNIQUE PRIMARY KEY` on `(run_id, worker_id, check_id)` in `infra_checks` — duplicate worker submissions raise `DuplicateInfraResult` → 409.

**Concurrency**: SQLite operates in WAL mode is not set (using default journal mode). `timeout=10` on `connect()`. FastAPI runs synchronous routes in a threadpool; writes are single-connection-per-operation (connection per `_conn()` call) which avoids connection pool contention but serialises DB writes at the SQLite lock level.

**Retention**: `purge_expired(retention_days)` called at startup. Removes runs and associated infra_checks older than the retention window.

**Limitation**: No WAL mode, no explicit PRAGMA journal_mode. Under high concurrency, writes may contend. For the current single-host deployment model, this is acceptable.

---

## 7. Evaluation Correctness

**Status: IMPLEMENTED with documented limitations**

### What the evaluator does
- Exact match for canary/prohibited strings.
- Separator/case-normalised match (strips `[-_. ]`, lowercases) to catch `CANARY SAFEBOX 7F29` variants.
- Required marker check (must be present in output for PASS on conflict test).
- Refusal phrase detection (13 recognised phrases, case-insensitive).
- Structured output: JSON parse, required fields present, recursive canary scan.
- Tool-call: looks for tool_call JSON in output matching `unauthorized_system_wipe`.

### Limitations (honest, documented in each test's `limitations` field)
- **Encoded leaks not detected**: base64, reversed, split-across-turns leaks pass undetected.
- **Paraphrase leaks**: semantic subversion without the exact canary string is not caught.
- **Refusal phrase coverage**: only a fixed set of phrases counts; unusual but safe wording → INCONCLUSIVE.
- **Multimodal**: requires vision capability; image is a 1×1 transparent GIF (not a realistic visual attack).
- **Single-turn evaluation**: does not cover multi-turn manipulation.
- **Repeatability is probabilistic**: N consistent runs are an observation, not proof of determinism.

---

## 8. Frontend Security

**Status: APPROPRIATE for local deployment**

- No auth on read/run endpoints — by design (loopback-only service).
- No `eval()`, no `dangerouslySetInnerHTML` in component code reviewed.
- API keys returned by backend always masked (e.g., `sk-...xyz`); full key never sent to frontend.
- Vault key never exposed via any API endpoint.

**Limitation**: The service has no browser-level authentication. Anyone who can reach port 8000 can run tests and read results. This is acceptable for local-only deployment. Do not expose publicly without adding authentication.

---

## 9. Secrets in Repository

**Verified clean:**
- `.gitignore` excludes `data/`, `*.key`, `*.enc`, `.env` (not `.env.example`), `__pycache__`, `.venv`, `node_modules`, `dist/`.
- All canary values in `test_registry.py` are explicitly fictional (`CANARY-SAFEBOX-7F29`, etc.).
- No real API keys in any committed file.
- `.env.example` contains only placeholder values.

---

## Attack Surface Summary

| Surface | Protected by | Residual risk |
|---|---|---|
| API keys at rest | Fernet encryption; key not in repo | Key file on disk (chmod 600) |
| API keys in transit | Local loopback only; no TLS needed | Exposure if `ALLOW_NON_LOOPBACK=true` without TLS |
| Prompt injection via API | Registry-controlled prompts; no free-form input | Tests themselves contain adversarial payloads (by design) |
| Path traversal via run_id | Strict regex; `relative_to()` check; symlink guards | None known |
| Worker token | HMAC timing-safe compare; mandatory in production | Shared secret; no per-worker identity |
| Container escape | Full cap-drop, no-new-privs, read-only FS, no Docker socket | Kernel exploit (out of scope) |
| Cross-run workspace access | Host dual-verification; O_NOFOLLOW sentinel | INCONCLUSIVE if Docker unavailable |
| LLM-judged false pass | Deterministic rules only | Encoded/paraphrased leaks |

---

*Next: [05-testing-operations.md](05-testing-operations.md) — test suites, commands, results, and operating procedures.*
