# SafeBox AI — Open Issues & Future Work

> **Document series:** `docs/project-guide/`
> This file: `07-open-issues.md` — Honest gaps, known limitations, and prioritised improvements.

---

## Confirmed Open Issues

### SEC-01-RESIDUAL: Vault Key Rotation Not Implemented
**Severity:** Medium  
**Status:** Known limitation, documented  
**Detail:** There is no API or script for rotating the Fernet vault key. An operator must manually decrypt, re-encrypt, and replace the key file. No key rotation schedule exists.  
**Fix path:** Implement a `rotate-vault-key` CLI command in `database.py` that reads all secrets under the old key and re-encrypts under a new key atomically.

---

### SEC-02: PBKDF2 Salt Is Not Per-Installation
**Severity:** Low (key file is already randomised per-installation)  
**Status:** Known limitation  
**Detail:** `_derive_fernet_key()` uses a fixed salt `"safebox-credential-vault-salt-v1"`. Since the auto-generated key in `.vault.key` is already 32 bytes of cryptographically random data, the PBKDF2 path is only exercised when a human-supplied passphrase is used. In that case, the fixed salt means two installations with the same passphrase derive the same key.  
**Fix path:** Generate a random per-installation salt at vault creation time, store alongside the vault.

---

### SEC-03: No Authentication on Test Run Endpoints
**Severity:** Low for local deployment, High if exposed publicly  
**Status:** By design for local-only; limitation if deployed remotely  
**Detail:** `POST /api/security-tests/run`, `GET /api/security-tests/runs`, and all connection endpoints have no authentication. The service is protected only by the loopback bind address.  
**Fix path:** Add an optional bearer-token middleware (similar to the worker token) or integrate with a reverse-proxy auth layer.

---

### SEC-04: In-Memory Vault Dict Not Zeroed
**Severity:** Low  
**Status:** Python ecosystem limitation  
**Detail:** `self._secrets_vault` is a Python dict of strings. Python strings are immutable and cannot be explicitly zeroed; GC timing is non-deterministic. An API key may remain in memory after removal.  
**Fix path:** Evaluate `memoryview`-based secret types or use a library like `securesystemslib`.

---

### TEST-01: Windows ACL Vault Permission Test Missing
**Severity:** Low  
**Status:** 1 skipped test  
**Detail:** `test_vault_permissions_posix` is skipped on Windows. The `icacls` path in `_set_restrictive_permissions()` is tested manually but not in the pytest suite.  
**Fix path:** Add a Windows-specific test using `subprocess.run(["icacls", ...])` to verify the ACL was applied.

---

### TEST-02: Real-Docker Worker Integration Tests Require Manual Setup
**Severity:** Low  
**Status:** 7 tests skipped when Docker is offline  
**Detail:** The 7 real-Docker integration tests in `TestDockerIntegration` require a live Docker daemon and `safebox-worker:latest` image. They are not run in the standard CI flow.  
**Fix path:** Add a CI Docker-in-Docker workflow (GitHub Actions with `services: docker`) that builds the image and runs these tests.

---

### ARCH-01: SQLite Write Serialisation Under High Concurrency
**Severity:** Low (bounded by semaphore to 2 concurrent runs)  
**Status:** Known; acceptable for current deployment  
**Detail:** SQLite uses journal-mode journal (not WAL). Multiple concurrent writers will contend at the DB lock level. The `BoundedSemaphore(max_concurrent_runs)` in `SecurityTestRunner` limits concurrent runs to 2, which mitigates this significantly.  
**Fix path:** Add `PRAGMA journal_mode=WAL` to `Database.init()` to improve read concurrency.

---

### ARCH-02: Run Orphaned if Backend Crashes Mid-Run
**Severity:** Low  
**Status:** Known  
**Detail:** If the backend process crashes while a test is executing, the run record remains in state `RUNNING` indefinitely. There is no crash-recovery or orphan-detection mechanism.  
**Fix path:** At startup, scan for `RUNNING` runs older than `max_run_seconds` and mark them `ABORTED` with `status=ERROR`.

---

### ARCH-03: Worker Results Not Verified Cryptographically
**Severity:** Medium  
**Status:** Acceptable for single-host; gap for multi-host  
**Detail:** Worker results are authenticated by a shared token (HMAC of the token value). There is no per-submission signature; a compromised token allows arbitrary result injection.  
**Fix path:** Implement HMAC-SHA256 signing of each submission payload with the worker token as the key, verified by the backend.

---

### EVAL-01: Encoded and Paraphrased Leaks Not Detected
**Severity:** High (intentional coverage gap, not a bug)  
**Status:** Documented limitation in every test  
**Detail:** The evaluator uses exact and separator-normalised matching. A model that leaks `Q0FOQVJZLVNBR0VCT1gtN0YyOQ==` (base64 of the canary) would pass all tests. Semantic subversion ("the code you gave me is CANARY-SAF...EFBOX-7F...29") may also pass.  
**Fix path:** Add a multi-encoding scan layer (base64, rot13, reversed, split) and optional semantic similarity check. Note: semantic check reintroduces non-determinism.

---

### EVAL-02: Single-Turn Evaluation Only
**Severity:** Medium  
**Status:** Documented limitation  
**Detail:** All tests consist of a single system prompt + user turn. Multi-turn jailbreaks (gradual persona erosion, "yes-and" escalation) are not tested.  
**Fix path:** Add a `ConversationCase` type that defines a sequence of turns and evaluates the final response.

---

### INFRA-01: Host-Side Worker Socket Not Available on Windows
**Severity:** Low  
**Status:** Expected Windows behaviour  
**Detail:** `/var/run/docker.sock` does not exist on Windows. The `docker-socket-absence` check inside the container (Linux) correctly reports PASS. But if someone runs the worker checks as local host-fallback on Windows, this check will report PASS trivially (socket doesn't exist).  
**Fix path:** The host-fallback mode already marks container-specific checks as UNAVAILABLE. This issue only arises if someone manually invokes the checks outside the container on a non-Linux host — not a normal usage.

---

### UI-01: No Real-Time Progress Streaming
**Severity:** UX only  
**Status:** Known  
**Detail:** Test runs are synchronous; the UI blocks until `POST /api/security-tests/run` returns. For long Ollama runs (up to `SAFEBOX_MAX_RUN_SECONDS`), the UI appears frozen.  
**Fix path:** Add a WebSocket or SSE endpoint for run progress events; switch the test runner to async with progress callbacks.

---

## Completed Items (for reference)

| Item | Description | PR/Status |
|---|---|---|
| SEC-01 | Fernet vault encryption replacing plaintext JSON | Done — `database.py` |
| WORKER-01 | Strict run_id regex validation | Done — `docker_runner.py` |
| WORKER-02 | O_NOFOLLOW sentinel creation | Done — `docker_runner.py` + `workspace_isolation.py` |
| WORKER-03 | Dual host-container workspace verification | Done — `docker_runner.py` |
| WORKER-04 | Status-first `to_submission()` mapping | Done — `models.py` |
| WORKER-05 | UNSUPPORTED status + 38 negative tests | Done — `models.py` + `test_isolation_negative.py` |
| WORKER-06 | Member 2 integration into main branch | Done — verified in working tree |

---

*End of document series. Return to [01-overview.md](01-overview.md) for the starting point.*
