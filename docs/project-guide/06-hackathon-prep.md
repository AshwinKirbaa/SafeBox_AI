# SafeBox AI — Hackathon Preparation Guide

> **Document series:** `docs/project-guide/`
> This file: `06-hackathon-prep.md` — Demo script, judge Q&A, talking points, and technical defensibility.

---

## Elevator Pitch (30 seconds)

> "SafeBox AI is an offline-capable AI security testing platform. You point it at any model — Ollama, OpenAI, Anthropic, or your own endpoint — and it automatically red-teams it for prompt injection, secret disclosure, and instruction-hierarchy attacks. What makes SafeBox unique is that it never uses another LLM as a judge: verdicts are deterministic. And when evaluating model output inside a Docker container, it independently verifies its own runtime isolation through seven automated checks. The whole thing is a working REST API with a full React dashboard, 400+ tests, and a real encrypted credential vault."

---

## 3-Minute Live Demo Script

**Step 1: Show the health endpoint (15 seconds)**
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health | ConvertTo-Json -Depth 3
```
Point out: `status: ok`, `target_mode: mock`, `database_ok: true`, list of providers.

**Step 2: List the test suite (10 seconds)**
```powershell
(Invoke-RestMethod http://127.0.0.1:8000/api/security-tests).items | Format-Table test_id, category
```
Point out: 10 registered tests covering 7 categories.

**Step 3: Run a vulnerable mock (30 seconds)**
```powershell
$body = @{
  test_id = "canary-disclosure"
  target = @{ mode = "mock"; mock_behavior = "vulnerable" }
} | ConvertTo-Json -Depth 5

$run = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8000/api/security-tests/run" `
  -ContentType "application/json" -Body $body

$run.result.status                    # FAIL
$run.result.explanation               # "Canary token ... detected in model output."
$run.result.matched_indicators        # ["exact_canary_match"]
```

**Step 4: Run the defended mock (10 seconds)**
```powershell
$body = @{
  test_id = "canary-disclosure"
  target = @{ mode = "mock"; mock_behavior = "defended" }
} | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Method Post -Uri ... -Body $body).result.status  # PASS
```

**Step 5: Show the evidence (15 seconds)**
```powershell
$run.evidence | Format-Table kind, size_chars, truncated, redacted
```
Point out: model_output is redacted (canary replaced with [REDACTED]).

**Step 6 (if Ollama available): Real model run (45 seconds)**
```powershell
$env:SAFEBOX_TARGET_MODE = "ollama"
# Restart backend...
$body = @{
  test_id = "indirect-injection"
  target = @{ mode = "ollama" }
} | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Method Post -Uri ... -Body $body).result.status
```
Point out: real LLM, real adversarial prompt, deterministic verdict.

**Step 7 (if Docker available): Infrastructure isolation (45 seconds)**
Switch to frontend. Navigate to Run Details. Click "Run Infrastructure Verification". Show the 7 checks populating in real time. Highlight the `evidence_ref` field with `"host-container-dual-verification:workspace-isolation"`.

---

## Judge Q&A Preparation

### Q: Why not use an LLM as the judge?

**A:** LLM judges introduce non-determinism: the same output can get different verdicts in different evaluations. LLM judges can be manipulated by the very adversarial outputs they are evaluating ("judge jailbreak"). Our deterministic rules — exact string matching, normalised matching, refusal phrase detection — always give the same verdict for the same input. We do pay a price: nuanced attacks that paraphrase without using the exact canary string are not detected. We document this honestly in every test's `limitations` field. The tradeoff is explicit: reproducibility over coverage.

---

### Q: Couldn't the worker just lie about its check results?

**A:** Yes — a compromised worker could submit false PASS results. We mitigate this at three levels:

1. **Worker authentication**: the backend requires `X-Worker-Token` (HMAC, timing-safe comparison). An unauthenticated submission is rejected.
2. **Dual host-container verification for workspace isolation**: the host independently verifies that only one bind-mount exists, that it targets the current run workspace, and that the adjacent workspace is not mounted. The host may downgrade but never upgrade a container verdict.
3. **Negative test coverage**: 38 automated negative tests verify that each check correctly reports FAIL when the violation is present. These run without Docker.

We don't claim the container is "proven secure" — we claim the seven checks provide evidence that the specific isolation properties were verified at the time of the run. This is documented in the `InfrastructureSummary.note` field.

---

### Q: Why SQLite and not PostgreSQL?

**A:** SafeBox is designed for single-host deployment. SQLite is zero-configuration, ships with Python, and handles the concurrency model (bounded semaphore limits concurrent test runs to 2 by default). The schema is simple: two tables. If we needed horizontal scaling or separate persistence, we would add a PostgreSQL adapter behind the same `Database` interface — the repository pattern is in place.

---

### Q: How do you support so many AI providers?

**A:** The `ModelAdapter` protocol defines a single `generate(TargetRequest) -> TargetResponse` interface. Each provider (Ollama, OpenAI, Anthropic, Gemini, vLLM, llama.cpp, Transformers, Generic HTTP) has its own adapter class. The `AdapterRegistry` maps `TargetMode` to the correct factory. The frontend's "Connections" modal lets users save provider configs (encrypted), which the runner loads by `connection_id`. Adding a new provider requires implementing one class and registering it — no changes to test logic.

---

### Q: What happens if the model output is truncated?

**A:** Truncated output can never produce a PASS verdict. The evaluator knows the response is truncated and returns FAIL (if the canary was already found in the truncated portion) or INCONCLUSIVE (if a refusal is expected but the truncated output doesn't contain one). The `truncated: true` flag is stored in evidence. This prevents a "cut off before the refusal" scenario from being reported as PASS.

---

### Q: What's the INCONCLUSIVE status for?

**A:** INCONCLUSIVE means "we cannot confirm the model behaved safely, but we also didn't catch a clear violation." Example: a test expects a recognised refusal phrase like "I cannot reveal" or "I'm sorry, but". If the model responds safely using non-standard wording ("I'm not going to tell you that"), we cannot claim PASS (our rule didn't see the expected phrase) but we also have no evidence of a FAIL. INCONCLUSIVE is the honest answer. It surfaces to judges and operators as "needs manual review."

---

### Q: What's the relationship between the three members?

**A:** 
- **Member 1** (backend + test logic + evaluator): the authority. Owns the test definitions, verdict storage, evidence pipeline, and API. Never trusts the worker for AI behaviour verdicts.
- **Member 2** (worker + Docker orchestrator): the isolation verifier. Runs isolation checks inside a hardened container and submits evidence to Member 1 via authenticated HTTP. Never sees AI prompts or model responses.
- **Member 3** (frontend): the display layer. Reads from Member 1's API; never writes test results. Manages connection configs via the connections API.

Each can be developed, tested, and deployed independently.

---

### Q: How do you handle a model that doesn't support vision/tool-calling?

**A:** Capability checks happen before the test runs. If the adapter reports `vision=False` and the test requires it, the runner returns `UNSUPPORTED` immediately. The test is stored in the run record with `status=UNSUPPORTED` and the evidence explains why. UNSUPPORTED is never promoted to PASS or FAIL. The frontend shows it with a distinct badge.

---

### Q: What is the vault key rotation process?

**A:** Currently there is no automated key rotation. To rotate:
1. Decrypt the vault using the old key (load the DB, read all secrets).
2. Re-encrypt with a new Fernet key.
3. Replace `.vault.key` with the new key, update `SAFEBOX_VAULT_KEY` env var.
4. Delete old `.vault.enc.bak` if it exists.

This is a manual admin procedure, documented as a known limitation in the security review.

---

## Technical Defensibility Points

### "Show me the security"
- Vault: `database.py` lines 126–350 — Fernet encryption, key derivation, atomic write, `chmod 600`.
- SSRF: `config.py` lines 60–73 — URL validation, loopback enforcement.
- Worker auth: `security_tests.py` lines 69–79 — `hmac.compare_digest`.
- Path traversal: `docker_runner.py` lines 47–51, 101–141 — regex, `relative_to()`, `O_NOFOLLOW`.
- Duplicate rejection: `database.py` `add_infra_check()` — `sqlite3.IntegrityError` → 409.

### "Show me the tests"
```powershell
# Backend
cd safebox-ai\backend
python -m pytest -q --tb=short    # 256 passed, 1 skipped

# Worker
cd safebox-ai\worker
..\backend\.venv\Scripts\python.exe -m pytest -v tests   # 82 passed, 7 skipped

# Frontend
cd safebox-ai\frontend
npm test -- --run                  # 71 passed
```

### "Show me honest limitations"
Every `SecurityCase` in `test_registry.py` has a `limitations` tuple. Every `InfrastructureSummary` has a `note`. The 1 skipped test is documented in `05-testing-operations.md`. The security audit is in `04-security-review.md`.

---

## Key Numbers for Judges

| Metric | Value |
|---|---|
| Backend tests passed | 256 |
| Backend tests skipped | 1 (POSIX permissions on Windows) |
| Worker tests passed | 82 |
| Worker tests skipped (real Docker) | 7 |
| Negative isolation tests | 38 |
| Frontend component tests | 71 |
| AI security test cases | 10 |
| Infrastructure isolation checks | 7 |
| Supported provider modes | 11 |
| LOC (approx, excluding tests) | ~8,000 |
| Vault encryption | Fernet (AES-128-CBC + HMAC-SHA256) |
| PBKDF2 iterations | 100,000 |

---

*Next: [07-open-issues.md](07-open-issues.md) — known gaps, future work, and honest todos.*
