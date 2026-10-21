# SafeBox AI — Universal Model Security Testing & Evaluation

SafeBox AI is a model-agnostic AI security testing platform with standardized adversarial evaluation, sanitized evidence pipelines, SQLite run history, and Docker infrastructure isolation verification.

It supports **universal inference targets across 3 tiers** (Ollama, OpenAI-Compatible, Generic HTTP JSON, Mock Simulator, OpenAI, Anthropic Claude, Google Gemini, Hugging Face, vLLM, llama.cpp, and local Transformers).

See [UNIVERSAL_MODELS.md](UNIVERSAL_MODELS.md) for complete architecture, provider matrix, SSRF protection, and connection API reference.
Sandbox isolation (Member 2) and the dashboard (Member 3) integrate through [INTEGRATION.md](INTEGRATION.md).

backend/app/
  config.py            validated settings (env prefix SAFEBOX_)
  schemas.py           Pydantic models, UTC timestamps, statuses
  database.py          SQLite run history + infrastructure results
  main.py              app factory, error handling, request-size limit
  api/security_tests.py  endpoints
  services/            model_adapter, mock_adapter, ollama_adapter, test_registry,
                       evaluator, runner, evidence
backend/tests/         pytest suite (no Docker / Ollama needed)
worker/                Member 2 sandbox worker container and isolation checks
  Dockerfile           Hardened non-root Linux container specification
  worker/              Isolation checks (docker socket, caps, cgroups, network)
  orchestrator/        Host-side runner and workspace manager
  tests/               Pytest isolation and contract test suite
  run_worker.ps1       PowerShell runner script
```

## Setup (Windows PowerShell)

```powershell
cd safebox-ai\backend
py -3.12 -m venv .venv            # or: python -m venv .venv
.\.venv\Scripts\Activate.ps1      # if blocked: Set-ExecutionPolicy -Scope Process Bypass
python -m pip install -r requirements.txt
```

## Run the tests

```powershell
python -m pytest -q
```

## Start the API (loopback only, mock mode by default)

Run from `safebox-ai\backend` (the SQLite file `data\safebox.sqlite3` and `.env` are resolved relative to it).

```powershell
python -m app
# equivalent: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a **second** PowerShell window:

```powershell
$api = "http://127.0.0.1:8000"
Invoke-RestMethod "$api/api/health"
(Invoke-RestMethod "$api/api/security-tests").items | Format-Table test_id, version, category

# Vulnerable target -> FAIL
$body = @{ test_id = "canary-disclosure"; target = @{ mode = "mock"; mock_behavior = "vulnerable" } } | ConvertTo-Json -Depth 5
$run = Invoke-RestMethod -Method Post -Uri "$api/api/security-tests/run" -ContentType "application/json" -Body $body
$run.result.status

# Defended target -> PASS
$body = @{ test_id = "canary-disclosure"; target = @{ mode = "mock"; mock_behavior = "defended" } } | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Method Post -Uri "$api/api/security-tests/run" -ContentType "application/json" -Body $body).result.status

# Retrieve one result / history
Invoke-RestMethod "$api/api/security-tests/runs/$($run.run_id)" | ConvertTo-Json -Depth 8
Invoke-RestMethod "$api/api/security-tests/runs?limit=10" | ConvertTo-Json -Depth 5

# Repeatability against a flaky mock (real repeated executions; outcomes disagree -> FAIL)
$body = @{ test_id = "repeatability"; target = @{ mode = "mock"; mock_behavior = "flaky" }; options = @{ repeat_count = 4 } } | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Method Post -Uri "$api/api/security-tests/run" -ContentType "application/json" -Body $body).result.repeatability
```

## Member 2 — Sandbox Worker & Isolation Verification

Run from `safebox-ai\worker`:

```powershell
# Run the 23 isolation and contract tests:
..\backend\.venv\Scripts\python.exe -m pytest -v tests

# Execute worker checks and submit to Member 1 backend:
powershell -ExecutionPolicy Bypass -File .\run_worker.ps1
```

See [worker/README.md](worker/README.md) for full documentation, container hardening details, and Docker Desktop setup.

## Switching to Ollama (optional)

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags | Select-Object -ExpandProperty models | Select-Object name  # installed models
ollama pull llama3.2:1b        # manual, once; SafeBox never downloads models
$env:SAFEBOX_TARGET_MODE = "ollama"
$env:SAFEBOX_OLLAMA_MODEL = "llama3.2:1b"
python -m app
# run a test against it:
$body = @{ test_id = "canary-disclosure"; target = @{ mode = "ollama" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/security-tests/run" -ContentType "application/json" -Body $body
```
Back to mock: `Remove-Item Env:SAFEBOX_TARGET_MODE, Env:SAFEBOX_OLLAMA_MODEL` and restart. `GET /api/health` shows
`ollama.reachable` / `model_available` in Ollama mode. Real models are non-deterministic; a PASS is one observation.
`ERROR` is expected if Ollama is down or the model is not installed — it is never reported as a pass.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope Process Bypass` |
| `ModuleNotFoundError: app` | run from `safebox-ai\backend`; use `python -m pytest` |
| `host must be loopback ...` | by design; set `SAFEBOX_ALLOW_NON_LOOPBACK=true` only if you accept the exposure |
| Port 8000 busy | `$env:SAFEBOX_PORT = "8001"` |
| Run returns `ERROR`, "Could not connect to the Ollama service" | start Ollama (`ollama serve`) and check `Invoke-RestMethod http://127.0.0.1:11434/api/tags` |
| `ERROR` "HTTP 404 ... model may not be installed" | `ollama pull <model>` yourself, match `SAFEBOX_OLLAMA_MODEL` |
| `400 target_mode_not_permitted` | server is in mock mode; set `SAFEBOX_TARGET_MODE=ollama` |
| `429 runner_busy` | too many concurrent runs; retry (limit `SAFEBOX_MAX_CONCURRENT_RUNS`) |
| `ollama_base_url must be loopback` | by design (SSRF guard); `SAFEBOX_ALLOW_REMOTE_OLLAMA=true` to override |

## Design notes and limitations

- **Deterministic rules, no LLM judge.** Exact/normalised string matching; unclear cases are `INCONCLUSIVE`.
  Encoded or paraphrased leaks are not detected (see each test's `limitations`).
- **Statuses**: PASS / FAIL / ERROR / INCONCLUSIVE. Truncated output can only yield FAIL or INCONCLUSIVE.
- **Concurrency**: runs execute synchronously inside the request thread (FastAPI threadpool). At most
  `SAFEBOX_MAX_CONCURRENT_RUNS` run at once (others get 429); a repeatability run of N executions takes up to
  N × `SAFEBOX_INFERENCE_TIMEOUT_SECONDS` (bounded by `SAFEBOX_MAX_RUN_SECONDS`, default 120 s).
- **Prompts are registry-controlled.** Clients cannot supply prompts, URLs, commands or paths;
  `SAFEBOX_MAX_PROMPT_LENGTH` is a guard on registry prompts.
- **Retention**: runs older than `SAFEBOX_EVIDENCE_RETENTION_DAYS` (default 30; 0 = keep) are purged at startup.
- **No authentication** on the read/run endpoints: the service is for loopback / trusted local use. Do not expose
  it publicly. Only the worker endpoint has an optional shared token.
- **Docker / Ollama networking decision.** No Docker Compose file is shipped. `host.docker.internal` and
  host-gateway behaviour differ between Docker Desktop (Windows), WSL2 and Linux, and giving a sandbox worker a
  route to the host just to reach Ollama would weaken isolation. SafeBox calls Ollama from the **backend process
  on the host** (loopback); the sandbox worker never talks to Ollama and receives no host access, no Docker
  socket and no secrets. If a worker must run a model call later, Member 2 should expose a narrow, authenticated
  proxy rather than host networking.
- SafeBox verifies AI behaviour only. It never marks the sandbox secure, and a container alone is not proof of
  complete isolation.
