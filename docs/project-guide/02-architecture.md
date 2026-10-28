# SafeBox AI — Architecture & Component Walkthrough

> **Document series:** `docs/project-guide/`
> This file: `02-architecture.md` — Directory tree, component responsibilities, and data flow.

---

## Directory Tree

```
safebox-ai/
├── README.md                  Entry-point: setup, quick-start, design notes
├── UNIVERSAL_MODELS.md        Provider matrix, SSRF protection, connection API
├── INTEGRATION.md             Member 1-2-3 contract, API schemas, protocol
├── .env.example               Example environment variables (no real secrets)
├── .gitignore
│
├── backend/                   Member 1 — FastAPI backend + evaluator
│   ├── app/
│   │   ├── __main__.py        Entry point: python -m app  (uvicorn launch)
│   │   ├── main.py            App factory, middleware, error handlers
│   │   ├── config.py          Settings (pydantic-settings, SAFEBOX_ prefix)
│   │   ├── database.py        SQLite layer + encrypted credential vault
│   │   ├── schemas.py         Pydantic models (public API + internal raw)
│   │   ├── api/
│   │   │   ├── security_tests.py   /api/security-tests/* endpoints
│   │   │   └── connections.py      /api/connections/* endpoints
│   │   └── services/
│   │       ├── test_registry.py    10 registered SecurityCase definitions
│   │       ├── runner.py           SecurityTestRunner (orchestrates adapters + DB)
│   │       ├── evaluator.py        Deterministic rule engine (verdict logic)
│   │       ├── evidence.py         EvidenceService (redaction, export)
│   │       ├── model_adapter.py    Abstract ModelAdapter protocol
│   │       ├── mock_adapter.py     Mock simulator (6 behaviours)
│   │       ├── ollama_adapter.py   Ollama HTTP adapter
│   │       ├── openai_compatible_adapter.py   OpenAI / vLLM / Groq / etc.
│   │       ├── generic_http_adapter.py        Generic JSON HTTP adapter
│   │       ├── provider_adapters.py           Anthropic, Gemini, HF, llama.cpp
│   │       ├── adapter_registry.py            Factory + provider metadata
│   │       └── security_network.py            SSRF helpers
│   ├── tests/                 256 backend unit / integration tests
│   └── requirements.txt
│
├── worker/                    Member 2 — Sandbox worker + host orchestrator
│   ├── Dockerfile             Hardened non-root Linux image
│   ├── README.md              Worker setup, Docker build, container hardening
│   ├── requirements.txt       (pydantic, requests — minimal deps)
│   ├── run_worker.ps1         PowerShell convenience runner
│   ├── worker/                Python package (runs inside container too)
│   │   ├── __init__.py
│   │   ├── config.py          Worker config: backend URL, token, paths
│   │   ├── main.py            Container entry point: parse args, run checks, output JSON
│   │   ├── models.py          IsolationCheckResult, InfraCheckSubmission, to_submission()
│   │   ├── runner.py          IsolationCheckRunner: discovers + runs all checks
│   │   ├── submitter.py       InfraSubmitter: HTTP POST to backend
│   │   ├── orchestrator/
│   │   │   └── docker_runner.py   DockerSandboxOrchestrator (host-side)
│   │   └── checks/
│   │       ├── __init__.py        ALL_CHECKS list export
│   │       ├── base.py            BaseIsolationCheck abstract class
│   │       ├── docker_socket.py   docker-socket-absence
│   │       ├── user_privileges.py non-root-execution
│   │       ├── dropped_capabilities.py  dropped-capabilities
│   │       ├── resource_limits.py resource-limits
│   │       ├── workspace_isolation.py   workspace-isolation
│   │       ├── host_filesystem.py host-filesystem-protection
│   │       └── network_egress.py  network-egress
│   └── tests/                 89 worker tests (unit + negative)
│       ├── test_checks.py
│       ├── test_orchestrator.py
│       └── test_isolation_negative.py
│
├── frontend/                  Member 3 — React + TypeScript SPA
│   ├── src/
│   │   ├── main.tsx           React entry point
│   │   ├── App.tsx            Root component: state, routing, data fetching
│   │   ├── App.css            Global design tokens + utility classes
│   │   ├── index.css          Base reset + font imports
│   │   ├── services/
│   │   │   └── api.ts         Typed API client (all backend calls)
│   │   ├── types/
│   │   │   ├── safebox.ts     TypeScript mirrors of Pydantic schemas
│   │   │   └── navigation.ts  AppPage union type
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          Left nav
│   │   │   ├── TopBar.tsx           Header bar (breadcrumb, refresh)
│   │   │   ├── TestLauncher.tsx     Test picker + target config form
│   │   │   ├── InfraIsolationPanel.tsx  7-check isolation status panel
│   │   │   ├── AiEvaluationPanel.tsx    AI verdict + evidence display
│   │   │   ├── EvidenceList.tsx     Evidence item renderer
│   │   │   ├── RunDetailView.tsx    Per-run composite view
│   │   │   ├── RunHistory.tsx       Paginated run list
│   │   │   ├── ModelConnectionsModal.tsx  Connection CRUD modal
│   │   │   ├── MagicBento.tsx       Overview dashboard bento grid
│   │   │   ├── WorkflowCanvas.tsx   Interactive pipeline graph
│   │   │   ├── WorkflowPipelineGraph.tsx  SVG pipeline animation
│   │   │   ├── StatusBadge.tsx      PASS/FAIL/ERROR/etc. badge
│   │   │   ├── TargetCursor.tsx     Custom cyber-reticle cursor
│   │   │   └── SafeBoxMagnet.tsx    Hero magnet interaction component
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx     Dashboard home
│   │   │   ├── TestLabPage.tsx      Test launch and last-result view
│   │   │   ├── WorkflowPage.tsx     Pipeline canvas host
│   │   │   ├── RunExplorerPage.tsx  History + filter
│   │   │   └── RunDetailsPage.tsx   Detailed single-run view
│   │   └── test/               71 Vitest frontend component tests
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── data/                      Runtime data (gitignored)
│   ├── safebox.sqlite3        SQLite run history
│   ├── .vault.key             Auto-generated Fernet key (never commit)
│   └── .vault.enc             Encrypted credential vault
│
├── scripts/                   Helper scripts
└── release/                   Packaged release artifacts
    ├── SafeBox_AI_integrated_member2.zip
    └── VERIFICATION_REPORT.md
```

---

## Component Responsibilities

### `backend/app/main.py` — App Factory
- Loads `Settings` and creates `Database`, `TestRegistry`, `EvidenceService`, and `SecurityTestRunner`.
- Registers two routers: `security_router` and `connections_router`.
- Middleware: request size limit (configurable, default 16 KB).
- Error handlers: validation error (422), HTTP error, unhandled exception (500 — never leaks internals).
- Exposes `GET /api/health` — the only endpoint that touches Ollama.

### `backend/app/config.py` — Settings
- `SAFEBOX_*` env prefix; also reads `backend/.env`.
- Validates `ollama_base_url` is loopback unless `SAFEBOX_ALLOW_REMOTE_OLLAMA=true` (SSRF guard).
- Validates `host` is loopback unless `SAFEBOX_ALLOW_NON_LOOPBACK=true`.
- `vault_key` and `worker_token` are `SecretStr` — never printed in logs or tracebacks.

### `backend/app/database.py` — SQLite + Vault
Three logical responsibilities:

1. **Run persistence** — `CREATE TABLE runs` + `infra_checks`. Raw JSON stored in `raw_json` column; indexes on `created_at`.
2. **Infrastructure check aggregation** — `infra_summary()` reads all worker check results for a run and applies worst-first precedence. A PASS requires all 7 checks from a single worker.
3. **Credential vault** — Fernet-encrypted `.vault.enc`. Key sourced in order: explicit arg, `SAFEBOX_VAULT_KEY` env, `.vault.key` file, auto-generate. Legacy `.vault.json` auto-migrated.

### `backend/app/schemas.py` — Pydantic Models
- `StrictModel`: `extra="forbid"` — all unknown fields rejected.
- `UtcDatetime`: always timezone-aware, normalised to UTC, serialised as ISO 8601 with millisecond precision.
- Key enums: `TestStatus` (PASS/FAIL/ERROR/INCONCLUSIVE/UNSUPPORTED), `InfraStatus` (PASS/FAIL/ERROR/PENDING/UNAVAILABLE/MISSING), `TargetMode`.
- `InfraCheckSubmission`: validated by both backend and worker (mirrored schema in `worker/worker/models.py`).

### `backend/app/services/test_registry.py` — Test Definitions
- 10 `SecurityCase` frozen dataclasses: `test_id`, `build_input()`, `params` (canary values, required marker, refusal required).
- All strings are fictional canaries (`CANARY-SAFEBOX-7F29`, etc.) — no real secrets.
- `sensitive_values()` exports all protected values for redaction in evidence.

### `backend/app/services/runner.py` — Test Runner
- `SecurityTestRunner.run()`: resolves adapter, acquires semaphore slot, executes test.
- `_execute()`: creates run record, calls `_evaluate()`, saves to DB, returns `RunRecord`.
- `_single_execution()`: calls `adapter.generate()`, calls `evaluator.evaluate()`.
- Capability check: if model lacks `structured_output` or `vision`, returns `UNSUPPORTED` (never `PASS`).

### `backend/app/services/evaluator.py` — Rule Engine
- `evaluate(case, response_text, truncated)` → `Verdict(status, explanation, matched_indicators)`.
- Truncated output → FAIL or INCONCLUSIVE (never PASS).
- Exact match + separator/case-normalised match (e.g., `CANARY-SAFEBOX-7F29` vs `CANARYSAFEBOX7F29`).
- `refusal_required=True`: looks for recognised refusal phrases; if absent → INCONCLUSIVE.
- `aggregate_repeats()`: majority vote for repeatability test.

### `backend/app/services/evidence.py` — Evidence Pipeline
- Redacts all `sensitive_values()` from stored model output before writing to DB.
- `export_run()` assembles `RunRecord` from raw data and infra summary — the public API shape.

### `worker/worker/orchestrator/docker_runner.py` — Host Orchestrator
Critical security-relevant code:

1. **`validate_run_id()`**: strict regex `^run_[0-9a-f]{16,32}$` — prevents path traversal.
2. **`prepare_workspaces()`**: resolves paths, guards symlinks with `O_CREAT|O_EXCL|O_NOFOLLOW`.
3. **`build_docker_run_args()`**: hardcoded security flags; no caller-controlled values in security-sensitive args.
4. **`verify_host_mount_isolation()`**: exactly one bind-mount, targets `/workspace:rw`, source matches current run workspace, adjacent workspace NOT mounted.
5. **`run_in_docker()`**: run_id mismatch detection, duplicate check_id detection, host-container reconciliation for workspace-isolation (host may confirm or downgrade, never upgrade).
6. **`execute_and_submit()`**: Docker-available path vs host-fallback path; host-fallback never claims PASS for container-only checks.

### `worker/worker/checks/` — Seven Isolation Checks
Each extends `BaseIsolationCheck` with `run(context) -> IsolationCheckResult`.

| Module | How it probes |
|---|---|
| `docker_socket.py` | `os.path.exists("/var/run/docker.sock")` inside container |
| `user_privileges.py` | `os.getuid()`, `os.getgid()`, `os.getgroups()` |
| `dropped_capabilities.py` | Reads `/proc/self/status` for `CapEff`; expects `0000000000000000` |
| `resource_limits.py` | `/sys/fs/cgroup/memory.max` (cgroups v2) or `/sys/fs/cgroup/memory/memory.limit_in_bytes` (v1); `/proc/sys/kernel/pid_max` |
| `workspace_isolation.py` | Write + O_NOFOLLOW read-back probe; enumerate adjacent paths; INCONCLUSIVE if no adjacent path exists |
| `host_filesystem.py` | `Path("/proc/1").exists()`, `Path("/etc/shadow").exists()`, `stat("/etc/passwd").st_ino` |
| `network_egress.py` | `socket.create_connection(("8.8.8.8", 53), timeout=3)` — expects `ConnectionRefusedError` |

### `worker/worker/models.py` — `to_submission()`
Converts local `IsolationCheckResult` to backend `InfraCheckSubmission`:

- `PASS`: `observed == expected` (backend derives PASS)
- `FAIL`: `observed != expected` (backend derives FAIL)
- `ERROR`: `reported_state="COMPLETED"` with `error` field set
- `UNAVAILABLE`, `INCONCLUSIVE`, `UNSUPPORTED`: `reported_state="UNAVAILABLE"` with `limitation` explaining why

### `backend/app/api/security_tests.py` — Worker Endpoint
`POST /api/security-tests/runs/{run_id}/infrastructure-checks`:

- `_authorise_worker()`: `hmac.compare_digest` on `X-Worker-Token` header (timing-safe).
- `run_id` in URL must match `run_id` in body.
- Verdict derived from `reported_state`, `error`, `observed == expected`.
- Duplicate submissions → 409 (not overwrite).

`POST /api/security-tests/runs/{run_id}/launch-worker`:
- Checks Docker availability; 503 if Docker down (unless `allow_host_fallback=true`).
- Concurrency guard: `active_infra_verifications` set on `app.state`.
- Clears prior infra checks for the run before launching.
- Uses in-process submit function to avoid network round-trip.

---

## Request / Response Flow for a Test Run

```
Browser clicks "Run Test"
  |
  v
Frontend: POST /api/security-tests/run
  {test_id, target: {mode, mock_behavior, ...}}
  |
  v
Backend: RunRequest validated (StrictModel, Pydantic)
  |
  v
SecurityTestRunner.run()
  |
  +-- Resolve adapter (MockAdapter / OllamaAdapter / ...)
  +-- Acquire semaphore slot (max 2 concurrent)
  +-- RawRunData created with state=RUNNING
  +-- DB.create_run()
  |
  v
_single_execution()
  |
  +-- case.build_input() -> system_prompt + user_prompt
  +-- adapter.generate() -> response_text
  +-- evaluator.evaluate() -> Verdict
  |
  v
EvidenceService.redact(response_text) -> redacted_text
DB.save_run(raw)
  |
  v
evidence.export_run() -> RunRecord (public schema)
  |
  v
Frontend receives RunRecord; displays verdict + evidence
  |
  v (user clicks "Run Isolation Verification")
Frontend: POST /api/security-tests/runs/{run_id}/launch-worker
  |
  v
DockerSandboxOrchestrator.execute_and_submit()
  |
  +-- prepare_workspaces(run_id)
  +-- docker run [hardened args] safebox-worker:latest
  |     -> Container runs 7 checks, outputs JSON
  +-- verify_host_mount_isolation()
  +-- Reconcile workspace-isolation verdict
  +-- to_submission() for each check
  +-- submit_infrastructure_check() (in-process)
  |
  v
DB.add_infra_check() for each result
Frontend: GET /api/security-tests/runs/{run_id}
  -> RunRecord.infrastructure shows aggregated InfrastructureSummary
```

---

*Next: [03-file-guide.md](03-file-guide.md) — per-file responsibility reference.*
