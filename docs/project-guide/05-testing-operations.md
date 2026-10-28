# SafeBox AI — Testing & Operations

> **Document series:** `docs/project-guide/`
> This file: `05-testing-operations.md` — Test suites, verified commands, operating modes, and operational procedures.

---

## Test Suite Summary

| Suite | Location | Count | Runner | Requires |
|---|---|---|---|---|
| Backend unit + integration | `backend/tests/` | 256 passed, 1 skipped | `pytest` | Python venv only |
| Worker isolation + contract | `worker/tests/` | 89 total (82 passed, 7 skipped with real Docker) | `pytest` | Python venv only |
| Frontend component | `frontend/src/test/` | 71 passed | `vitest` | `npm install` |

**No tests require a live Ollama instance or live Docker daemon to pass.** Docker-dependent worker tests skip gracefully when Docker is unavailable.

---

## Backend Tests

### Setup
```powershell
cd safebox-ai\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Run
```powershell
python -m pytest -q
```

### Coverage areas
- `test_vault_hardening.py` — Fernet encryption, key derivation, missing key, bad key, corrupted ciphertext, legacy migration, atomic write, permissions
- `test_security_tests.py` — All 10 registered tests × mock behaviours; PASS/FAIL/INCONCLUSIVE/ERROR/UNSUPPORTED verdicts; infra check aggregation; duplicate rejection; run_id validation
- `test_connections.py` — CRUD for saved connections, masked key response, vault integration
- `test_config.py` — Settings validation, loopback guards, SSRF protection

### The One Skipped Test
```
backend/tests/test_security_tests.py::test_vault_permissions_posix
```
**What it covers**: verifies that `chmod 600` (mode `0o600`) is correctly applied to `.vault.key` and `.vault.enc` on POSIX systems.

**Why it is skipped on Windows**: `os.chmod` has limited semantics on Windows; `stat().st_mode` does not reflect Unix permission bits. The test calls `pytest.mark.skipif(os.name == 'nt', ...)`.

**Equivalent coverage**: the Windows code path uses `icacls` to restrict vault files to the current user only. This is tested manually but not via automated test (no pytest fixture for Windows ACL verification exists in this suite). The vault encryption itself (which is the primary protection) is fully tested on both platforms.

---

## Worker Tests

### Setup
Worker uses the backend venv:
```powershell
cd safebox-ai\worker
..\backend\.venv\Scripts\python.exe -m pytest -v tests
```

### Test Files

**`test_checks.py`** (~50 tests)
- Unit tests for each of the 7 isolation checks.
- Mocked filesystem contexts: docker socket absent/present, UID 0 vs 10001, capabilities `0000...` vs non-zero, cgroups v1/v2 memory values, network connection refused vs connected.
- `workspace_isolation`: write probe success/failure, adjacent directory breach detection, INCONCLUSIVE when no adjacent paths.

**`test_orchestrator.py`** (~32 tests)
- `validate_run_id()`: valid IDs pass; path traversal patterns fail.
- `prepare_workspaces()`: symlink detection, path containment.
- `build_docker_run_args()`: flag presence, values, ordering.
- `verify_host_mount_isolation()`: exactly-one-mount, adjacent-not-mounted, source-match, missing-sentinel.
- `run_in_docker()` with mocked `subprocess.run`: run_id mismatch detection, duplicate check_id detection, workspace-isolation reconciliation (PASS/INCONCLUSIVE/FAIL/ERROR paths).
- `to_submission()`: all CheckStatus values correctly mapped to `reported_state`.

**`test_isolation_negative.py`** (38 tests) — **negative tests**
Verifies checks **correctly report FAIL or UNAVAILABLE** when a violation is present:
- Docker socket exposed: `docker_socket.py` returns `FAIL`
- UID 0 execution: `user_privileges.py` returns `FAIL`
- Root supplementary group: `user_privileges.py` returns `FAIL`
- Non-zero capability bits: `dropped_capabilities.py` returns `FAIL`
- Memory limit exceeded/missing: `resource_limits.py` returns `FAIL`
- PID limit exceeded/missing: `resource_limits.py` returns `FAIL`
- Adjacent workspace accessible: `workspace_isolation.py` returns `FAIL`
- Protected secret readable: `workspace_isolation.py` returns `FAIL`
- `/proc/1` accessible: `host_filesystem.py` returns `FAIL`
- Network egress succeeds: `network_egress.py` returns `FAIL`

**7 real-Docker tests** (skipped when Docker is offline):
- `test_orchestrator.py::TestDockerIntegration::*` — requires live Docker daemon and `safebox-worker:latest` image.

---

## Frontend Tests

### Setup
```powershell
cd safebox-ai\frontend
npm install
```

### Run
```powershell
npm test
# or: npx vitest run
```

### Coverage
- `InfraIsolationPanel.test.tsx` — renders 7-check isolation panel; PASS/FAIL/UNAVAILABLE/MISSING status display; "Run verification" button; launch-worker API call triggered correctly.
- Component tests use MSW (Mock Service Worker) or Vitest mocks for API calls.

### Production Build
```powershell
npm run build
# output: frontend/dist/
```

---

## Operating Modes

### Mode 1: Mock Testing (No External Dependencies)

The default mode. No Ollama, no Docker required.

**Start backend:**
```powershell
cd safebox-ai\backend
.\.venv\Scripts\Activate.ps1
python -m app
```

**Start frontend:**
```powershell
cd safebox-ai\frontend
npm run dev
# opens http://localhost:5173
```

**Run a test via API:**
```powershell
$body = @{
  test_id = "canary-disclosure"
  target = @{ mode = "mock"; mock_behavior = "vulnerable" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/security-tests/run" `
  -ContentType "application/json" -Body $body
```

**Verified behaviour:** PASS/FAIL/INCONCLUSIVE/ERROR all reproduced deterministically via `mock_behavior`.

---

### Mode 2: Live Ollama Evaluation

Requires Ollama running locally with a model downloaded.

**Prerequisites:**
```powershell
winget install Ollama.Ollama   # or download from ollama.com
ollama pull llama3.2:3b        # download model once
ollama serve                   # start daemon
```

**Verify Ollama:**
```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

**Start backend in Ollama mode:**
```powershell
$env:SAFEBOX_TARGET_MODE = "ollama"
$env:SAFEBOX_OLLAMA_MODEL = "llama3.2:3b"
python -m app
```

**Check health:**
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
# ollama.reachable = true, model_available = true
```

**Run a test:**
```powershell
$body = @{
  test_id = "canary-disclosure"
  target = @{ mode = "ollama" }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/security-tests/run" `
  -ContentType "application/json" -Body $body
```

**Verified behaviour (actual runs):** Real LLM responses are non-deterministic. Results vary by model size, temperature, and sampling. `ERROR` is expected if Ollama is unreachable — it is never promoted to `PASS`.

**Reset to mock:**
```powershell
Remove-Item Env:SAFEBOX_TARGET_MODE, Env:SAFEBOX_OLLAMA_MODEL
```

---

### Mode 3: Infrastructure Isolation Verification (Docker required)

Requires Docker Desktop running and the worker image built.

**Build worker image:**
```powershell
cd safebox-ai\worker
docker build -t safebox-worker:latest .
```

**Configure worker token (recommended):**
```powershell
# In backend/.env:
# SAFEBOX_WORKER_TOKEN=my-secret-token-here
```

**Launch verification via API:**
```powershell
$run_id = "run_<your-run-id>"
Invoke-RestMethod -Method Post `
  "http://127.0.0.1:8000/api/security-tests/runs/$run_id/launch-worker"
```

Or via the frontend: run any test, then click "Run Infrastructure Verification" in the Run Details page.

**Expected result:** `infrastructure.status = "PASS"` when all 7 checks pass from a single worker. `UNAVAILABLE` for checks that depend on Linux cgroups (normal on Docker Desktop for Windows).

**Without Docker:**
The backend returns `503 docker_unavailable` by default. With `?allow_host_fallback=true`, the host-side checks run and report `UNAVAILABLE` for container-specific checks.

---

## Startup and Shutdown

### Normal startup sequence
1. Backend starts (`python -m app`): creates `data/` directory, opens SQLite, purges old runs, generates vault key if needed.
2. Frontend dev server starts (`npm run dev`): Vite HMR on port 5173, proxies API if configured.
3. Worker image is available for on-demand launch from backend.

### Normal shutdown
- Backend: `Ctrl+C` (Uvicorn handles graceful shutdown; no in-flight runs are interrupted mid-write because tests are synchronous).
- Frontend: `Ctrl+C` in the Vite process.
- No explicit Docker containers remain after a run (all launched with `--rm`).

### Recovery from failures

**Backend crash during test run:**
- Run will be in state `RUNNING` in the DB (incomplete).
- On next startup, the run remains orphaned — it will never transition to `COMPLETED`.
- No automatic cleanup; old `RUNNING` runs are kept until `purge_expired` removes them.

**Docker container crash / timeout:**
- Orchestrator sends `docker rm -f <container_name>` before raising.
- Workspace is cleaned up in the `finally` block.
- Backend returns 500 `worker_execution_failed`.

**Vault key missing after restart:**
- Backend starts with vault locked (`_vault_locked=True`).
- Existing saved connections are inaccessible; `VaultLockedError` raised on any credential operation.
- Fix: restore `SAFEBOX_VAULT_KEY` env var or `.vault.key` file with the original key.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `SAFEBOX_ENVIRONMENT` | `development` | One of: development, test, staging, production |
| `SAFEBOX_TARGET_MODE` | `mock` | Default evaluation mode |
| `SAFEBOX_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `SAFEBOX_OLLAMA_MODEL` | `llama3.2:3b` | Ollama model identifier |
| `SAFEBOX_ALLOW_REMOTE_OLLAMA` | `false` | Allow non-loopback Ollama URL |
| `SAFEBOX_ALLOW_OLLAMA_TARGET` | `false` | Allow Ollama in non-Ollama mode |
| `SAFEBOX_INFERENCE_TIMEOUT_SECONDS` | `30.0` | Per-model-call timeout |
| `SAFEBOX_MAX_PROMPT_LENGTH` | `4000` | Max combined prompt length |
| `SAFEBOX_MAX_RESPONSE_CHARS` | `4000` | Truncate model responses above this |
| `SAFEBOX_MAX_REQUEST_BYTES` | `16384` | HTTP request body limit |
| `SAFEBOX_MAX_CONCURRENT_RUNS` | `2` | Parallel test semaphore |
| `SAFEBOX_MAX_RUN_SECONDS` | `120.0` | Total run deadline |
| `SAFEBOX_DATABASE_PATH` | `data/safebox.sqlite3` | SQLite file path |
| `SAFEBOX_EVIDENCE_MAX_EXCERPT_CHARS` | `500` | Evidence excerpt truncation |
| `SAFEBOX_EVIDENCE_RETENTION_DAYS` | `30` | Purge runs older than N days (0 = keep all) |
| `SAFEBOX_HOST` | `127.0.0.1` | Bind address |
| `SAFEBOX_PORT` | `8000` | Listen port |
| `SAFEBOX_ALLOW_NON_LOOPBACK` | `false` | Allow public-facing bind |
| `SAFEBOX_WORKER_TOKEN` | — | Shared token for worker auth |
| `SAFEBOX_VAULT_KEY` | — | Fernet key for credential vault |

---

## Troubleshooting Reference

| Symptom | Cause | Fix |
|---|---|---|
| `Activate.ps1 cannot be loaded` | PowerShell execution policy | `Set-ExecutionPolicy -Scope Process Bypass` |
| `ModuleNotFoundError: app` | Wrong working directory | `cd safebox-ai\backend` then `python -m pytest` |
| `host must be loopback` | Config guard | Set `SAFEBOX_ALLOW_NON_LOOPBACK=true` (accept risk) |
| Port 8000 busy | Another process | `$env:SAFEBOX_PORT = "8001"` |
| Run returns `ERROR`, Ollama unreachable | Ollama not running | `ollama serve` then verify `/api/tags` |
| `ERROR` HTTP 404 model not installed | Model missing | `ollama pull <model>` |
| `400 target_mode_not_permitted` | Server in mock mode | Set `SAFEBOX_TARGET_MODE=ollama` |
| `429 runner_busy` | Concurrent run limit | Wait and retry; increase `SAFEBOX_MAX_CONCURRENT_RUNS` |
| `ollama_base_url must be loopback` | SSRF guard | Set `SAFEBOX_ALLOW_REMOTE_OLLAMA=true` if intentional |
| `503 docker_unavailable` | Docker Desktop stopped | Start Docker Desktop; wait for daemon |
| `409 duplicate_check` | Worker re-ran without clearing | UI clears on "Run verification"; or use new run_id |
| Vault locked at startup | Missing `SAFEBOX_VAULT_KEY` | Restore key; or delete `.vault.enc` to reset (loses credentials) |

---

*Next: [06-hackathon-prep.md](06-hackathon-prep.md) — Q&A, talking points, and demo script for judges.*
