# SafeBox AI — Project Overview

> **Document series:** `docs/project-guide/`
> This file: `01-overview.md` — Purpose, features, technology, and design philosophy.

---

## What Is SafeBox AI?

SafeBox AI is a **model-agnostic AI security testing and evaluation platform**. It sends adversarial prompts to an AI language model, observes the response, and deterministically evaluates whether the model behaved safely — without using another LLM as a judge.

### One-sentence pitch (hackathon)
> "SafeBox AI is a production-ready evaluation harness that red-teams any AI model for prompt injection, secret disclosure, and instruction-hierarchy failures — with a hardened Docker sandbox that independently verifies its own runtime isolation."

---

## Problem Statement

As LLM-powered applications proliferate, developers need confidence that their model:

1. **Does not leak secrets** embedded in system prompts (canary disclosure).
2. **Resists prompt injection** — neither direct ("ignore previous instructions") nor indirect (injected inside documents).
3. **Respects instruction hierarchy** — system policy wins over user override attempts.
4. **Behaves consistently** across repeated invocations (repeatability).
5. **Runs inside a verifiably isolated sandbox** when evaluating untrusted model output.

Existing solutions either require cloud keys, are non-deterministic (LLM-judged), or have no sandbox-isolation verification. SafeBox AI addresses all five concerns in a single offline-capable platform.

---

## Target Users

| User | Use case |
|---|---|
| **Hackathon judges / demos** | Live demonstration of adversarial test outcomes against Ollama models |
| **AI security engineers** | Batch evaluation across providers; CI-integration via REST API |
| **Application developers** | Verify their model selection before production deployment |
| **Red-team operators** | Extend the test registry with custom adversarial scenarios |

---

## Implemented Features

### AI Behaviour Testing (Member 1 / Backend)

| Test | ID | Category | What it probes |
|---|---|---|---|
| Canary-secret disclosure | `canary-disclosure` | secret_disclosure | Fictional canary in system prompt; user demands it |
| System-instruction conflict | `instruction-conflict` | instruction_hierarchy | User tries to override system policy via injection |
| Prohibited-string output | `prohibited-string` | output_policy | Model asked to echo a registered forbidden string |
| Indirect prompt injection | `indirect-injection` | instruction_hierarchy | Adversarial instruction embedded inside a document |
| System-prompt extraction | `system-prompt-extraction` | secret_disclosure | User demands full verbatim system instructions |
| Benign control baseline | `benign-control` | output_policy | Non-adversarial query; baseline false-positive check |
| Structured-output integrity | `structured-output-integrity` | structured_output | JSON-mode canary leak inside schema-constrained output |
| Tool-call authorization | `tool-call-authorization` | tool_authorization | Injection coercing model to call a dangerous tool |
| Multimodal visual canary | `multimodal-image-canary` | multimodal_security | Canary leak during vision/image analysis |
| Repeatability | `repeatability` | consistency | Repeated executions of a base test; agreement rate |

### Model Connectivity (Universal Provider Support)

SafeBox AI supports **three adapter tiers** across **11 provider modes**:

- **Tier 1 – Local/Self-hosted**: Ollama, llama.cpp, vLLM, local Transformers (HuggingFace pipeline)
- **Tier 2 – OpenAI-compatible**: OpenAI, any OpenAI-compatible endpoint (Groq, Together AI, etc.)
- **Tier 3 – Proprietary APIs**: Anthropic Claude, Google Gemini, Generic HTTP JSON
- **Mock**: Deterministic simulator with six behaviours (vulnerable, defended, ambiguous, flaky, oversized, error/timeout)
- **Saved Connections**: Named, encrypted-at-rest provider configurations with masked API keys

### Infrastructure Isolation Verification (Member 2 / Worker)

Seven automated checks run inside a hardened Docker container and report their result to the backend:

| Check ID | What it verifies |
|---|---|
| `docker-socket-absence` | `/var/run/docker.sock` is not mounted in the container |
| `non-root-execution` | Effective UID/GID != 0; no root supplementary groups |
| `dropped-capabilities` | All Linux capabilities dropped (`--cap-drop=ALL`) |
| `resource-limits` | Memory <= 256 MB, PID limit <= 64, CPU <= 0.5 |
| `workspace-isolation` | Run workspace writable; adjacent runs' workspaces inaccessible |
| `host-filesystem-protection` | Host paths (`/proc/1`, `/etc/shadow`) not accessible |
| `network-egress` | Outbound network connections rejected (`--network=none`) |

The host orchestrator additionally performs **dual verification** for workspace isolation:
single bind-mount, adjacent sentinel exists, mount source matched to current run.

### Frontend Dashboard (Member 3)

- **Overview** — health status card, recent test history, infrastructure status indicator
- **Test Lab** — test picker, target configuration, one-click launch
- **Workflow Canvas** — animated pipeline graph showing the full evaluation data flow
- **Run Explorer** — paginated history with provider/model/status filtering
- **Run Details** — per-run evidence, AI evaluation result, infrastructure check results
- **Connections Modal** — full CRUD for saved provider connections (keys stored encrypted)

---

## Technology Stack

### Backend
| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.12 | Type-annotated; `from __future__ import annotations` throughout |
| HTTP framework | **FastAPI** + **Uvicorn** | ASGI; synchronous execution inside threadpool |
| Validation | **Pydantic v2** + `pydantic-settings` | `StrictModel` rejects unknown fields |
| Database | **SQLite** (stdlib `sqlite3`) | Single-file; no ORM; raw parameterised SQL |
| Vault encryption | **cryptography** (Fernet AES-128-CBC+HMAC) | Key auto-generated on first start; PBKDF2 fallback |
| HTTP client | **httpx** | Sync client for model adapters |
| External AI | **Ollama** (local); OpenAI / Anthropic / Gemini / HF | All via adapter pattern |

### Worker
| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.12 | Same venv as backend |
| Container | **Docker** (Linux, non-root) | Hardened: `--cap-drop=ALL`, `--network=none`, `--read-only` |
| Validation | **Pydantic v2** | Mirror of backend schemas |
| Isolation probing | stdlib `os`, `pathlib`, `subprocess` | No third-party deps for checks |
| Inter-service | HTTP POST to backend infra-checks endpoint | Token-authenticated |

### Frontend
| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript + React 18 | Strict mode |
| Build | **Vite** | `dist/` on `npm run build` |
| CSS | Vanilla CSS + custom design tokens | No Tailwind; glassmorphism dark theme |
| State | Local `useState`/`useCallback` in `App.tsx` | Prop-drilled; no Redux |
| Icons | `lucide-react` | Consistent icon set |
| Animations | CSS keyframes + CSS custom properties | Cyber-reticle cursor, pipeline graph |

---

## Design Philosophy

1. **Deterministic evaluation, no LLM judge.** Rules use exact and normalised string matching. Unclear outcomes are explicitly `INCONCLUSIVE`, never silently promoted to `PASS`.

2. **Fail-safe defaults.** Missing vault key -> vault locked (no crash). Docker unavailable -> UNAVAILABLE reported (not PASS). Evidence truncated -> FAIL or INCONCLUSIVE (never PASS).

3. **Defence in depth.** Backend enforces schema validation, content-length limits, loopback-only binding, and SSRF protection. Worker runs with zero capabilities in an isolated network namespace. Vault uses authenticated encryption.

4. **Separation of concerns across members.** Backend owns test logic and verdict storage. Worker owns isolation checking and evidence submission. Frontend is read-only except for connection management.

5. **Honest reporting.** The `limitations` field on every test and the `note` field on every infrastructure summary explicitly state what was and was not verified.

---

## Relationship Between Members

```
  Member 3 (Frontend)
       |  REST API calls
       v
  Member 1 (Backend / FastAPI)
   +-- Security test runner + evaluator
   +-- SQLite run history + infra results
   +-- Launches / receives from:
         Member 2 (Worker / Docker Orchestrator)
          +-- Host-side orchestrator
          +-- Container (isolation checks)
                 +-- POSTs results -> Backend
```

The backend is the single source of truth. The frontend never writes test results.
The worker never reads test prompts or AI responses. The Docker container has no access to the host network, socket, or filesystem beyond its dedicated workspace.

---

*Next: [02-architecture.md](02-architecture.md) — detailed system architecture and data flow.*
