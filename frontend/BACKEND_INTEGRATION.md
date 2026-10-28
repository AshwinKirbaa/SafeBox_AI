# SafeBox AI backend-compatible UI

This frontend targets the FastAPI contracts in the uploaded SafeBox ai (2).zip. It preserves the cinematic UI and connects supported controls to real endpoints. The backend itself is not deployed with the public preview.

## Local integration on macOS
Place this frontend next to your existing backend project. Start the original backend with its existing environment and dependencies; no credentials from the uploaded ZIP are copied into this package.

From your backend project directory:
```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
In another terminal, from this frontend directory:
```sh
npm ci
npm run dev
```
Open the URL printed by Vite. Its /api proxy targets http://127.0.0.1:8000, avoiding cross-origin requests without changing backend CORS.
For a different local backend port:
```sh
SAFEBOX_BACKEND_URL=http://127.0.0.1:8001 npm run dev
```
For production, serve the built UI and reverse-proxy /api to your FastAPI service on the same origin. The uploaded backend has no CORS middleware and is configured for loopback by default. VITE_SAFEBOX_API_BASE is an optional build-time API URL; a cross-origin endpoint needs deliberate CORS configuration. Do not place provider API keys or worker tokens in VITE variables.

## Wired actions
| UI action | Backend contract |
| --- | --- |
| Health/readiness | GET /api/health |
| Provider metadata | GET /api/connections/providers |
| List/create connections | GET/POST /api/connections |
| Edit/delete connection | PATCH/DELETE /api/connections/{connection_id} |
| Discover model names | GET /api/connections/{connection_id}/models |
| Probe selected model/type | POST /api/connections/test |
| Verify live inference | POST /api/connections/{connection_id}/verify-live |
| Registered tests | GET /api/security-tests |
| Run security test | POST /api/security-tests/run |
| Paginated filtered runs | GET /api/security-tests/runs |
| Full run report | GET /api/security-tests/runs/{run_id} |
| Launch Docker isolation checks | POST /api/security-tests/runs/{run_id}/launch-worker?allow_host_fallback=false |
| Sandbox event trail | GET /api/security-tests/runs/{run_id}/audit-events |
| Activity log | GET /api/activity-logs |

The browser never submits infrastructure-check results and never receives the worker token. Isolation remains independent of behavioral evaluation.

## Corrected UI assumptions
- Backend model types are chat, embedding, vision, image_generation, speech_to_text, text_to_speech, classification, regression, reranking and custom.
- Discovery returns strings, not a per-model capability index. Probe a specific model/type before enabling security evaluation. Required test capabilities come from registered test metadata.
- Connection editing does not send provider because SavedConnectionUpdate disallows it. Blank API key preserves the server secret; secrets are not stored in the browser.
- Test payloads contain test_id, target and options. There is no arbitrary prompt, image/audio/document upload field or settings-write endpoint. Unsupported controls were removed.
- Global settings are server-owned. The UI exposes per-run timeout only. No host-fallback switch is provided.
- Run list supports provider, model, status, limit and offset. Date/model-type filtering is not advertised as a backend query.
- Run details read result.token_usage and result.observed_latency_ms, evidence references, limitations and worker observed/expected values.
- Inference requests are synchronous. A client timeout does not cancel backend execution. Refresh the run list before retrying.
- Landing recommendations remain deterministic local matching; configured provider model discovery is available, but the backend contains no recommendation-chat endpoint.

## Verification
19 automated tests pass, including fetch-mocked endpoint/method/payload contracts, error parsing, independent verdicts and evidence association. Production build passes. These are not end-to-end tests against a running uploaded backend: its Python runtime dependencies are unavailable in this build environment. Live providers, Docker execution and GPU animation need testing on your machine. No uploaded secrets, vaults, databases, audit logs, screenshots or nested archives are included.
