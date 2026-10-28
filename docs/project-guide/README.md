# SafeBox AI — Project Guide

**A comprehensive technical knowledge base for developers, contributors, and hackathon judges.**

Built from direct inspection of the actual repository. All claims are traceable to source code.

---

## Document Index

| # | File | Contents |
|---|---|---|
| 1 | [01-overview.md](01-overview.md) | Project purpose, features, technology stack, design philosophy |
| 2 | [02-architecture.md](02-architecture.md) | Directory tree, component responsibilities, full request/response flow |
| 3 | [03-api-dataflow.md](03-api-dataflow.md) | Every REST endpoint, request/response schemas, verdict derivation |
| 4 | [04-security-review.md](04-security-review.md) | Vault encryption, input validation, SSRF guards, Docker isolation |
| 5 | [05-testing-operations.md](05-testing-operations.md) | Test suite counts, verified commands, operating modes, startup/shutdown |
| 6 | [06-hackathon-prep.md](06-hackathon-prep.md) | Demo script, judge Q&A, talking points, key metrics |
| 7 | [07-open-issues.md](07-open-issues.md) | Known gaps, honest limitations, prioritised future work |

---

## Quick Reference

### Start the backend (mock mode, no dependencies)
```powershell
cd safebox-ai\backend
.\.venv\Scripts\Activate.ps1
python -m app
```

### Run all tests
```powershell
# Backend (256 passed, 1 skipped)
cd backend && python -m pytest -q

# Worker (82 passed, 7 skipped without Docker)
cd worker && ..\backend\.venv\Scripts\python.exe -m pytest -v tests

# Frontend (71 passed)
cd frontend && npm test -- --run
```

### Test counts (verified)
| Suite | Passed | Skipped | Reason |
|---|---|---|---|
| Backend | 256 | 1 | POSIX permissions test on Windows |
| Worker unit | 82 | 7 | Real-Docker integration tests |
| Negative isolation | 38 | 0 | All pass without Docker |
| Frontend | 71 | 0 | — |

### Implemented security tests
`canary-disclosure`, `instruction-conflict`, `prohibited-string`, `indirect-injection`,
`system-prompt-extraction`, `benign-control`, `structured-output-integrity`,
`tool-call-authorization`, `multimodal-image-canary`, `repeatability`

### Infrastructure isolation checks
`docker-socket-absence`, `non-root-execution`, `dropped-capabilities`,
`resource-limits`, `workspace-isolation`, `host-filesystem-protection`, `network-egress`

---

## Source File Cross-Reference

| Concept | Primary source file |
|---|---|
| Vault encryption | `backend/app/database.py` lines 104–350 |
| Fernet key derivation | `backend/app/database.py` lines 126–147 |
| Settings & SSRF guard | `backend/app/config.py` |
| Test definitions | `backend/app/services/test_registry.py` |
| Evaluation rules | `backend/app/services/evaluator.py` |
| Evidence redaction | `backend/app/services/evidence.py` |
| Test runner | `backend/app/services/runner.py` |
| API endpoints | `backend/app/api/security_tests.py` |
| Connection management | `backend/app/api/connections.py` |
| Docker orchestrator | `worker/worker/orchestrator/docker_runner.py` |
| Isolation checks | `worker/worker/checks/*.py` |
| Submission schema | `worker/worker/models.py` |
| Frontend state | `frontend/src/App.tsx` |
| API client | `frontend/src/services/api.ts` |
| TypeScript schemas | `frontend/src/types/safebox.ts` |
