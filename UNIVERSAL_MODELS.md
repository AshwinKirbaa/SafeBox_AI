# SafeBox AI — Universal Model Compatibility & Adapter Architecture

## Overview

SafeBox AI has been upgraded from a dual-target system (Mock + Ollama) into a model-agnostic AI security evaluation platform. It can connect to, discover, and evaluate a comprehensive ecosystem of local and cloud inference systems through a normalized `ModelAdapter` interface while maintaining strict security boundaries, secret redacting, and dual-plane infrastructure independence.

---

## 1. Provider Tier Matrix

SafeBox AI organizes inference providers into three standardized tiers:

| Tier | Provider ID | Description | Default Protocol / Endpoint | Auth & Secret Handling | Supported Modalities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier A** | `ollama` | Local Ollama engine | `http://localhost:11434` | None required; local discovery via `/api/tags` | Text, Vision |
| **Tier A** | `openai_compatible` | Any OpenAI API compatible server | Configurable (e.g. `https://api.openai.com/v1`) | Bearer Token / API Key (Server-vaulted) | Text, Structured Output, Tool Calling |
| **Tier A** | `generic_http` | Custom HTTP JSON inference endpoint | User-defined URL + templating | Header-based token / custom headers | Text (mapped via json path) |
| **Tier A** | `mock` | Deterministic behavioral simulator | In-memory | None | Text, Structured Output, Tool Calling, Vision |
| **Tier B** | `openai` | Official OpenAI API | `https://api.openai.com/v1` | Server-vaulted `OPENAI_API_KEY` | Text, Vision, Structured Output, Tool Calling |
| **Tier B** | `anthropic` | Anthropic Claude API | `https://api.anthropic.com/v1` (`/v1/messages`) | `x-api-key` header (`ANTHROPIC_API_KEY`) | Text, Vision, Structured Output, Tool Calling |
| **Tier B** | `gemini` | Google Gemini API | `https://generativelanguage.googleapis.com/v1beta` | Query parameter / Header (`GEMINI_API_KEY`) | Text, Vision, Audio, Structured Output, Tool Calling |
| **Tier B** | `huggingface` | Hugging Face Hosted Inference | `https://api-inference.huggingface.co/models` | Bearer Token (`HUGGINGFACE_API_KEY`) | Text |
| **Tier B** | `vllm` | vLLM Self-Hosted Inference Server | `http://localhost:8000/v1` | Optional Bearer Token | Text, Structured Output, Tool Calling |
| **Tier C** | `llamacpp` | llama.cpp standalone server | `http://localhost:8080/completion` or `/v1` | Optional Bearer Token | Text |
| **Tier C** | `transformers` | Local Hugging Face Transformers pipeline | In-process execution / local weights | None | Text |

---

## 2. Common Model Adapter Contract

All connectors inherit from `ModelAdapter` (`backend/app/services/model_adapter.py`):

```python
class ModelAdapter(ABC):
    @property
    @abstractmethod
    def provider(self) -> str: ...

    @property
    @abstractmethod
    def capabilities(self) -> ModelCapabilities: ...

    @abstractmethod
    async def generate(self, req: TargetRequest, timeout: float = 30.0) -> TargetResponse: ...

    @abstractmethod
    async def check_connection(self) -> ConnectionCheckResult: ...

    @abstractmethod
    async def discover_models(self) -> list[str]: ...
```

### Exception Taxonomy
All provider-specific transport or HTTP errors map into standard SafeBox exceptions:
- `TargetAuthError`: Invalid credentials, 401/403 responses.
- `TargetModelNotFoundError`: Requested model is absent or not pulled.
- `TargetRateLimitError`: HTTP 429 quota exhaustion.
- `TargetUnsupportedError`: Triggered when a test modality is requested that the model does not support.
- `TargetHTTPError`: HTTP 5xx or server failures.
- `TargetConnectionError`: Connection refused, DNS failure, or network drop.
- `TargetTimeout`: Response deadline exceeded.
- `TargetResponseError`: Response exceeds maximum size limit (1 MB) or is corrupt/unparseable.

---

## 3. Security Controls & SSRF Protection

Custom endpoints and user-supplied URLs are untrusted by default. The security engine enforces:

1. **SSRF Guard (`backend/app/services/security_network.py`):**
   - Resolves hostnames to IP addresses prior to HTTP requests.
   - Blocks cloud instance metadata services (e.g. AWS/GCP/Azure `169.254.169.254`).
   - Blocks private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and loopback (`127.0.0.0/8`) unless explicitly permitted by connection configuration.
   - Validates schemes (HTTPS preferred; HTTP permitted only for local dev/testing).
2. **Secret Redaction & Vaulting:**
   - Raw API keys and secrets are vaulted server-side in memory and encrypted metadata.
   - Frontend API responses mask secrets (`sk-...XYZ` or `***`) and never return secret keys in plain text.
   - Request URLs, logs, and evidence payloads pass through `sanitize_secrets_from_text`.
3. **No Prompt Leakage during Discovery:**
   - Discovery endpoints (`GET /models`, `GET /tags`) only invoke provider catalog endpoints. No test prompts are ever transmitted during discovery.
4. **Request & Response Envelopes:**
   - Strict HTTP body streaming limits (maximum 1 MB) protect against memory exhaustion attacks.

---

## 4. Capability-Aware Evaluation

SafeBox AI tests are classified by modality and capability:
- **`structured-output-integrity`**: Requires `structured_output` capability.
- **`tool-call-authorization`**: Requires `tool_calling` capability.
- **`multimodal-image-canary`**: Requires `vision` capability.
- **Core Text Adversarial Tests**: `canary-disclosure`, `direct-injection`, `indirect-injection`, `system-instruction-extraction`, `instruction-hierarchy-conflict`, `benign-task-utility`, `output-policy-violation`.

### Honest Rejection (`UNSUPPORTED`)
If an evaluation test requires capabilities that the model does not possess (e.g., running vision tests against a text-only model):
- The run produces an `UNSUPPORTED` verdict with a detailed limitation explanation.
- An `UNSUPPORTED` result is **never** counted or displayed as a security `PASS`.

---

## 5. Security Plane Separation

SafeBox AI strictly separates:
1. **AI Behavioral Safety**: Evaluates model output strings against deterministic rules, canary trackers, and regex policies.
2. **Infrastructure Isolation**: The 7 Docker sandbox isolation checks verify:
   - Absence of Docker socket mount.
   - Non-root user privileges.
   - Dropped Linux capabilities (`ALL` dropped).
   - Enforced memory and CPU cgroup bounds.
   - Workspace directory isolation.
   - Host filesystem read/write protection.
   - Strict egress network restrictions.

> **Remote Cloud Provider Notice**: When evaluating remote cloud targets (OpenAI, Anthropic, Gemini, etc.), SafeBox AI explicitly indicates in the UI and evidence that Docker isolation checks verify the **local test execution harness**, not the remote provider's proprietary cloud infrastructure.

---

## 6. Model Connections API Reference

### List Supported Providers
```http
GET /api/connections/providers
```
Returns list of provider metadata, capability matrices, and default endpoints.

### Manage Saved Connections
```http
GET    /api/connections
POST   /api/connections
GET    /api/connections/{id}
PATCH  /api/connections/{id}
DELETE /api/connections/{id}
```

### Test Connection & Model Discovery
```http
POST /api/connections/test
Content-Type: application/json

{
  "provider": "openai_compatible",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "model": "gpt-4o-mini"
}
```

### Discover Available Models
```http
GET /api/connections/{id}/models
```

### Run Security Test with Saved Connection
```http
POST /api/security-tests/run
Content-Type: application/json

{
  "test_id": "canary-disclosure",
  "target": {
    "mode": "openai_compatible",
    "connection_id": "conn-xyz",
    "model": "gpt-4o-mini"
  }
}
```
