"""Provider-specific adapters for major LLM providers and execution environments.

Implements native adapters for:
- OpenAI API (OpenAIAdapter)
- Anthropic API (AnthropicAdapter)
- Google Gemini API (GeminiAdapter)
- Hugging Face Inference (HuggingFaceAdapter)
- vLLM (VLLMAdapter)
- llama.cpp server (LlamaCppAdapter)
- Local Transformers pipeline (TransformersPipelineAdapter)
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from app.services.model_adapter import (
    ConnectionCheckResult,
    ModelAdapter,
    ModelCapabilities,
    TargetAuthError,
    TargetConnectionError,
    TargetError,
    TargetHTTPError,
    TargetModelNotFoundError,
    TargetRateLimitError,
    TargetRequest,
    TargetResponse,
    TargetResponseError,
    TargetTimeout,
    TargetUnsupportedError,
    TokenUsage,
    clamp_output,
)
from app.services.openai_compatible_adapter import OpenAICompatibleAdapter
from app.services.security_network import sanitize_secrets_from_text, validate_endpoint_url

logger = logging.getLogger("safebox.providers")


# --------------------------------------------------------------------------- #
# 1. OpenAI API Adapter
# --------------------------------------------------------------------------- #
class OpenAIAdapter(OpenAICompatibleAdapter):
    """Native OpenAI API adapter targeting https://api.openai.com/v1."""

    name = "openai"
    provider = "openai"
    is_remote = True

    KNOWN_MODELS = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
        "o1",
        "o1-mini",
        "o3-mini",
    ]

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        client: httpx.Client | None = None,
    ) -> None:
        super().__init__(
            base_url=base_url,
            model=model,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            max_response_chars=max_response_chars,
            allow_localhost=False,
            allow_private=False,
            client=client,
            capabilities=ModelCapabilities(
                text=True,
                vision=True,
                audio=False,
                structured_output=True,
                tool_calling=True,
            ),
        )

    def generate(self, request: TargetRequest) -> TargetResponse:
        if not self.api_key or not self.api_key.strip():
            raise TargetAuthError(
                "OpenAI API key is missing. Configure an API key in Saved Connections "
                "or set the OPENAI_API_KEY environment variable in backend/.env."
            )
        return super().generate(request)

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        if not self.api_key or not self.api_key.strip():
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                error_message="OpenAI API key is not configured. Configure an API key in Saved Connections or set the OPENAI_API_KEY environment variable in backend/.env.",
            )
        return super().check_connection(timeout_seconds=timeout_seconds)

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        if not self.api_key or not self.api_key.strip():
            return self.KNOWN_MODELS
        discovered = super().discover_models(timeout_seconds)
        if discovered:
            return discovered
        return self.KNOWN_MODELS


# --------------------------------------------------------------------------- #
# 2. Anthropic API Adapter
# --------------------------------------------------------------------------- #
class AnthropicAdapter(ModelAdapter):
    """Native Anthropic API adapter targeting https://api.anthropic.com/v1/messages."""

    name = "anthropic"
    provider = "anthropic"
    is_remote = True

    KNOWN_MODELS = [
        # Fallback list only (used when no key / discovery fails). Authoritative list comes from
        # GET /v1/models. Verify against your account before relying on a specific ID.
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-haiku-20240307",
    ]

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-3-5-sonnet-20241022",
        base_url: str = "https://api.anthropic.com",
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        self.max_http_bytes = max_response_chars * 4 + 16384
        self._client = client
        self.capabilities = ModelCapabilities(
            text=True,
            vision=True,
            audio=False,
            structured_output=True,
            tool_calling=True,
        )

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "User-Agent": "SafeBox-Security-Auditor/1.0",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key.strip()
        return headers

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        if not self.api_key or not self.api_key.strip():
            raise TargetAuthError(
                "Anthropic Claude API key is missing. Configure an API key in Saved Connections "
                "or set the ANTHROPIC_API_KEY environment variable in backend/.env."
            )

        endpoint = f"{self.base_url}/v1/messages"
        content: list[dict[str, Any]] = []

        if request.images:
            for img in request.images:
                # Handle base64 or URL
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": img.split(",")[-1] if "," in img else img,
                    },
                })
        content.append({"type": "text", "text": request.user_prompt})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": max(16, self.max_response_chars // 3),
            "temperature": request.temperature,
        }
        if request.system_prompt:
            payload["system"] = request.system_prompt
        if request.tools:
            payload["tools"] = list(request.tools)

        start = time.perf_counter()
        client, owned = self._http()
        body = bytearray()
        try:
            with client.stream("POST", endpoint, json=payload, headers=self._get_headers(),
                               timeout=self.timeout_seconds) as resp:
                if resp.status_code == 401 or resp.status_code == 403:
                    raise TargetAuthError(f"Anthropic authorization failed (HTTP {resp.status_code}).")
                if resp.status_code == 404:
                    raise TargetModelNotFoundError(f"Anthropic model '{self.model}' not found.")
                if resp.status_code == 429:
                    raise TargetRateLimitError("Anthropic rate limit exceeded (HTTP 429).")
                if resp.status_code >= 400:
                    raise TargetHTTPError(f"Anthropic returned HTTP {resp.status_code}.")

                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_http_bytes:
                        raise TargetResponseError("Anthropic response exceeded size limit.")
                    if time.perf_counter() - start > self.timeout_seconds:
                        raise TargetTimeout("Anthropic inference timed out.")
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Anthropic connection timed out.") from exc
        except httpx.TransportError as exc:
            clean = sanitize_secrets_from_text(str(exc))
            raise TargetConnectionError(f"Could not connect to Anthropic: {clean}") from exc
        finally:
            if owned:
                client.close()

        try:
            data = json.loads(bytes(body))
            content_blocks = data.get("content", [])
            text_blocks = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
            text = "".join(text_blocks)
        except Exception as exc:
            raise TargetResponseError(f"Malformed response from Anthropic API: {exc}") from exc

        # Extract token usage
        usage_data = data.get("usage", {})
        prompt_tokens = usage_data.get("input_tokens")
        completion_tokens = usage_data.get("output_tokens")
        total_tokens = ((prompt_tokens or 0) + (completion_tokens or 0)) if (prompt_tokens or completion_tokens) else None
        usage = TokenUsage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens)

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)

        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            token_usage=usage,
            provider=self.provider,
        )

    def _fetch_models_paginated(
        self,
        client: httpx.Client,
        timeout_seconds: float = 5.0,
        max_pages: int = 10,
        max_models: int = 500,
    ) -> tuple[int, list[str], str | None]:
        """Fetch models from Anthropic /v1/models using pagination.

        Uses `limit=1000` and `after_id` query parameter according to the Anthropic API.
        The response contains `data` (list of model objects), `has_more` (bool), and
        `last_id` (str, cursor for next page).
        Guards against loops via `seen_cursors`, limits total pages and total models.
        Keeps API key strictly in headers (never in URLs or logs).
        """
        all_models: list[str] = []
        seen_cursors: set[str] = set()
        seen_ids: set[str] = set()
        cursor: str | None = None
        status_code = 200

        for page in range(max_pages):
            params: dict[str, Any] = {"limit": 1000}
            if cursor:
                params["after_id"] = cursor

            resp = client.get(
                f"{self.base_url}/v1/models",
                params=params,
                headers=self._get_headers(),
                timeout=timeout_seconds,
            )
            status_code = resp.status_code
            if resp.status_code != 200:
                if page == 0:
                    return status_code, [], f"Anthropic model listing returned HTTP {status_code}"
                # Non-first page error: stop and return models collected so far
                break

            try:
                data = resp.json()
            except Exception:
                if page == 0:
                    return status_code, [], "Anthropic model listing returned invalid JSON."
                break

            items = data.get("data", [])
            for item in items:
                if isinstance(item, dict) and item.get("id"):
                    mid = str(item["id"]).strip()
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        all_models.append(mid)
                        if len(all_models) >= max_models:
                            break

            if len(all_models) >= max_models:
                break

            has_more = data.get("has_more", False)
            if not has_more:
                break

            next_cursor = data.get("last_id")
            if not next_cursor and items and isinstance(items[-1], dict):
                next_cursor = items[-1].get("id")

            if not next_cursor or next_cursor in seen_cursors:
                break

            seen_cursors.add(next_cursor)
            cursor = next_cursor

        return status_code, all_models, None

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        if not self.api_key:
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                error_message="Anthropic API key is not configured.",
            )

        start = time.perf_counter()
        client, owned = self._http()
        try:
            status_code, models, err = self._fetch_models_paginated(client, timeout_seconds=timeout_seconds)
            latency = int((time.perf_counter() - start) * 1000)
            if status_code in (401, 403):
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message="Invalid Anthropic API key.",
                )
            if status_code == 200 and not err:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=self.model in models if models else False,
                    latency_ms=latency,
                    discovered_models=tuple(models or self.KNOWN_MODELS),
                    capabilities=self.capabilities,
                    error_message=None if models else "Anthropic returned an empty model list; model availability is unconfirmed.",
                )
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                latency_ms=latency,
                error_message=err or f"Anthropic model listing returned HTTP {status_code}; model availability is unconfirmed.",
            )
        except Exception as exc:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Anthropic connection check error: {sanitize_secrets_from_text(str(exc))}",
            )
        finally:
            if owned:
                client.close()

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        if not self.api_key:
            return self.KNOWN_MODELS
        client, owned = self._http()
        try:
            status_code, models, _ = self._fetch_models_paginated(client, timeout_seconds=timeout_seconds)
            if status_code == 200 and models:
                return sorted(models)
            return self.KNOWN_MODELS
        except Exception:
            return self.KNOWN_MODELS
        finally:
            if owned:
                client.close()



# --------------------------------------------------------------------------- #
# 3. Google Gemini API Adapter
# --------------------------------------------------------------------------- #
class GeminiAdapter(ModelAdapter):
    """Native Google Gemini API adapter targeting Google Generative AI REST endpoints."""

    name = "gemini"
    provider = "gemini"
    is_remote = True

    KNOWN_MODELS = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-lite-preview-02-05",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-flash-latest",
        "gemini-pro-latest",
    ]

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gemini-2.0-flash",
        base_url: str = "https://generativelanguage.googleapis.com",
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        self.max_http_bytes = max_response_chars * 4 + 16384
        self._client = client
        self.capabilities = ModelCapabilities(
            text=True,
            vision=True,
            audio=True,
            structured_output=True,
            tool_calling=True,
        )

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        if not self.api_key or not self.api_key.strip():
            raise TargetAuthError(
                "Google Gemini API key is missing. Configure an API key in Saved Connections "
                "or set the GEMINI_API_KEY environment variable in backend/.env."
            )

        # Normalize model ID: remove leading 'models/' if present so path is not duplicated
        clean_model = self.model
        if clean_model.startswith("models/"):
            clean_model = clean_model[7:]

        endpoint = f"{self.base_url}/v1beta/models/{clean_model}:generateContent"
        # Key goes in the header only: a ?key= URL parameter is written to httpx/proxy logs.
        headers = {"x-goog-api-key": self.api_key.strip()}

        user_parts: list[dict[str, Any]] = [{"text": request.user_prompt}]
        if request.images:
            for img in request.images:
                user_parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img.split(",")[-1] if "," in img else img,
                    }
                })

        contents = [{"role": "user", "parts": user_parts}]
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "maxOutputTokens": max(16, self.max_response_chars // 3),
            },
        }
        if request.system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": request.system_prompt}]}
        if request.schema_constraint:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        start = time.perf_counter()
        client, owned = self._http()
        body = bytearray()
        try:
            with client.stream("POST", endpoint, headers=headers, json=payload,
                               timeout=self.timeout_seconds) as resp:
                if resp.status_code >= 400:
                    data_preview = resp.read().decode("utf-8", errors="ignore")
                    error_msg = None
                    try:
                        err_json = json.loads(data_preview)
                        if isinstance(err_json, dict) and "error" in err_json:
                            error_msg = err_json["error"].get("message")
                    except Exception:
                        pass

                    clean_err = sanitize_secrets_from_text(error_msg or data_preview)
                    if resp.status_code in (400, 401, 403):
                        if "API_KEY_INVALID" in data_preview or "API key not valid" in data_preview:
                            raise TargetAuthError(clean_err or "Gemini API key is invalid or unauthorized.")
                        if resp.status_code == 403:
                            raise TargetAuthError(clean_err or "Gemini API access denied (HTTP 403).")
                    if resp.status_code == 404:
                        raise TargetModelNotFoundError(clean_err or f"Gemini model '{self.model}' not found.")
                    if resp.status_code == 429:
                        raise TargetRateLimitError(clean_err or "Gemini API quota/rate limit exceeded (HTTP 429).")
                    raise TargetHTTPError(clean_err or f"Gemini API returned HTTP {resp.status_code}.")

                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_http_bytes:
                        raise TargetResponseError("Gemini response exceeded maximum size limit.")
                    if time.perf_counter() - start > self.timeout_seconds:
                        raise TargetTimeout("Gemini inference timed out.")
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Gemini connection timed out.") from exc
        except httpx.TransportError as exc:
            clean = sanitize_secrets_from_text(str(exc))
            raise TargetConnectionError(f"Could not connect to Gemini service: {clean}") from exc
        finally:
            if owned:
                client.close()

        try:
            data = json.loads(bytes(body))
            candidates = data.get("candidates", [])
            text = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts if "text" in p)
        except Exception as exc:
            raise TargetResponseError(f"Malformed JSON response from Gemini API: {exc}") from exc

        # Extract token usage
        meta = data.get("usageMetadata", {})
        prompt_tokens = meta.get("promptTokenCount")
        completion_tokens = meta.get("candidatesTokenCount")
        total_tokens = meta.get("totalTokenCount")
        usage = TokenUsage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens)

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)

        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            token_usage=usage,
            provider=self.provider,
        )

    def _fetch_models_paginated(
        self,
        client: httpx.Client,
        timeout_seconds: float = 5.0,
        max_pages: int = 10,
        max_models: int = 500,
    ) -> tuple[int, list[str], str | None]:
        """Fetch models from Gemini /v1beta/models using pagination.

        Uses `pageSize=1000` and `pageToken` according to the Google Generative AI API.
        The response contains `models` (list of model objects) and `nextPageToken` (str).
        Guards against loops via `seen_tokens`, limits total pages and total models.
        Keeps API key strictly in the `x-goog-api-key` header (never in URLs or logs).
        """
        all_models: list[str] = []
        seen_tokens: set[str] = set()
        seen_names: set[str] = set()
        page_token: str | None = None
        status_code = 200

        for page in range(max_pages):
            params: dict[str, Any] = {"pageSize": 1000}
            if page_token:
                params["pageToken"] = page_token

            resp = client.get(
                f"{self.base_url}/v1beta/models",
                params=params,
                headers={"x-goog-api-key": self.api_key.strip()},
                timeout=timeout_seconds,
            )
            status_code = resp.status_code
            if resp.status_code != 200:
                if page == 0:
                    return status_code, [], f"Gemini model listing returned HTTP {status_code}"
                # Non-first page error: stop and return models collected so far
                break

            try:
                data = resp.json()
            except Exception:
                if page == 0:
                    return status_code, [], "Gemini model listing returned invalid JSON."
                break

            items = data.get("models", [])
            for item in items:
                if isinstance(item, dict):
                    methods = item.get("supportedGenerationMethods", ["generateContent"])
                    if "generateContent" in methods:
                        raw_name = item.get("name", "")
                        clean_name = raw_name.replace("models/", "").strip()
                        if clean_name and clean_name not in seen_names:
                            seen_names.add(clean_name)
                            all_models.append(clean_name)
                            if len(all_models) >= max_models:
                                break

            if len(all_models) >= max_models:
                break

            next_page_token = data.get("nextPageToken")
            if not next_page_token or next_page_token in seen_tokens:
                break

            seen_tokens.add(next_page_token)
            page_token = next_page_token

        return status_code, all_models, None

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        if not self.api_key:
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                error_message="Gemini API key is not configured.",
            )

        start = time.perf_counter()
        client, owned = self._http()
        try:
            status_code, models, err = self._fetch_models_paginated(client, timeout_seconds=timeout_seconds)
            latency = int((time.perf_counter() - start) * 1000)
            if status_code in (400, 401, 403):
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message="Invalid Gemini API key.",
                )
            if status_code == 200 and not err:
                clean_model = self.model.replace("models/", "")
                model_avail = clean_model in models if models else False
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=model_avail,
                    latency_ms=latency,
                    discovered_models=tuple(models or self.KNOWN_MODELS),
                    capabilities=self.capabilities,
                    error_message=None if models else "Gemini returned an empty model list; model availability is unconfirmed.",
                )
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                latency_ms=latency,
                error_message=err or f"Gemini model listing returned HTTP {status_code}; model availability is unconfirmed.",
            )
        except Exception as exc:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Gemini connection error: {sanitize_secrets_from_text(str(exc))}",
            )
        finally:
            if owned:
                client.close()

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        if not self.api_key:
            return self.KNOWN_MODELS
        client, owned = self._http()
        try:
            status_code, models, _ = self._fetch_models_paginated(client, timeout_seconds=timeout_seconds)
            if status_code == 200 and models:
                return sorted(models)
            return self.KNOWN_MODELS
        except Exception:
            return self.KNOWN_MODELS
        finally:
            if owned:
                client.close()
        return self.KNOWN_MODELS


# --------------------------------------------------------------------------- #
# 4. Hugging Face Inference API Adapter
# --------------------------------------------------------------------------- #
class HuggingFaceAdapter(ModelAdapter):
    """Adapter for Hugging Face Hosted Inference Endpoints."""

    name = "huggingface"
    provider = "huggingface"
    is_remote = True

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "meta-llama/Llama-3.2-3B-Instruct",
        base_url: str = "https://api-inference.huggingface.co/models",
        timeout_seconds: float = 60.0,
        max_response_chars: int = 4000,
        client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        self.max_http_bytes = max_response_chars * 4 + 16384
        self._client = client
        self.capabilities = ModelCapabilities(text=True)

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "SafeBox-Security-Auditor/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key.strip()}"
        return headers

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        if not self.api_key or not self.api_key.strip():
            raise TargetAuthError(
                "Hugging Face API token is missing. Configure a token in Saved Connections "
                "or set the HF_TOKEN environment variable in backend/.env."
            )

        endpoint = f"{self.base_url}/{self.model}"
        combined_prompt = f"System: {request.system_prompt}\nUser: {request.user_prompt}\nAssistant:" if request.system_prompt else request.user_prompt
        payload = {
            "inputs": combined_prompt,
            "parameters": {
                "max_new_tokens": max(16, self.max_response_chars // 4),
                "temperature": max(0.01, request.temperature),
                "return_full_text": False,
            },
        }

        start = time.perf_counter()
        client, owned = self._http()
        body = bytearray()
        try:
            with client.stream("POST", endpoint, json=payload, headers=self._get_headers(),
                               timeout=self.timeout_seconds) as resp:
                if resp.status_code == 503:
                    # Model loading on Hugging Face cold start
                    raise TargetTimeout("Hugging Face model is currently loading (cold start). Retry shortly.")
                if resp.status_code == 401 or resp.status_code == 403:
                    raise TargetAuthError("Hugging Face authorization failed. Invalid API token.")
                if resp.status_code == 404:
                    raise TargetModelNotFoundError(f"Hugging Face model '{self.model}' not found.")
                if resp.status_code == 429:
                    raise TargetRateLimitError("Hugging Face rate limit exceeded.")
                if resp.status_code >= 400:
                    raise TargetHTTPError(f"Hugging Face returned HTTP {resp.status_code}.")

                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_http_bytes:
                        raise TargetResponseError("Hugging Face response exceeded size limit.")
                    if time.perf_counter() - start > self.timeout_seconds:
                        raise TargetTimeout("Hugging Face inference timed out.")
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Hugging Face request timed out.") from exc
        except httpx.TransportError as exc:
            clean = sanitize_secrets_from_text(str(exc))
            raise TargetConnectionError(f"Could not connect to Hugging Face: {clean}") from exc
        finally:
            if owned:
                client.close()

        try:
            data = json.loads(bytes(body))
            text = ""
            if isinstance(data, list) and data:
                first = data[0]
                text = first.get("generated_text", "") if isinstance(first, dict) else str(first)
            elif isinstance(data, dict):
                text = data.get("generated_text", "")
        except Exception as exc:
            raise TargetResponseError(f"Malformed response from Hugging Face: {exc}") from exc

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)

        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            provider=self.provider,
        )

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        if not self.api_key or not self.api_key.strip():
            return ConnectionCheckResult(
                reachable=True,
                model_available=False,
                error_message="Hugging Face API token is not configured. Configure a token in Saved Connections or set the HF_TOKEN environment variable in backend/.env.",
            )
        start = time.perf_counter()
        client, owned = self._http()
        try:
            resp = client.get(f"{self.base_url}/{self.model}", headers=self._get_headers(), timeout=timeout_seconds)
            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code == 401 or resp.status_code == 403:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message="Invalid Hugging Face token or authorization failed.",
                )
            if resp.status_code == 404:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message=f"Model '{self.model}' not found on Hugging Face.",
                )
            if resp.status_code >= 400:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message=f"Hugging Face returned HTTP {resp.status_code}; model availability is unconfirmed.",
                )
            return ConnectionCheckResult(
                reachable=True,
                model_available=True,
                latency_ms=latency,
                discovered_models=(self.model,),
                capabilities=self.capabilities,
            )
        except Exception as exc:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Hugging Face connection error: {exc}",
            )
        finally:
            if owned:
                client.close()

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        return [self.model]


# --------------------------------------------------------------------------- #
# 5. vLLM Adapter (Specialized OpenAI-Compatible for High-Throughput Inference)
# --------------------------------------------------------------------------- #
class VLLMAdapter(OpenAICompatibleAdapter):
    """Adapter for vLLM self-hosted inference servers."""

    name = "vllm"
    provider = "vllm"
    is_remote = False

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8000/v1",
        model: str = "meta-llama/Llama-3.2-3B-Instruct",
        api_key: str | None = None,
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        allow_localhost: bool = True,
        allow_private: bool = True,
        client: httpx.Client | None = None,
    ) -> None:
        super().__init__(
            base_url=base_url,
            model=model,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            max_response_chars=max_response_chars,
            allow_localhost=allow_localhost,
            allow_private=allow_private,
            client=client,
            capabilities=ModelCapabilities(
                text=True,
                vision=True,
                audio=False,
                structured_output=True,
                tool_calling=True,
            ),
        )


# --------------------------------------------------------------------------- #
# 6. llama.cpp Server Adapter
# --------------------------------------------------------------------------- #
class LlamaCppAdapter(OpenAICompatibleAdapter):
    """Adapter for llama.cpp server (supports both /v1/chat/completions and /completion)."""

    name = "llamacpp"
    provider = "llamacpp"
    is_remote = False

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8080/v1",
        model: str = "default",
        api_key: str | None = None,
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        allow_localhost: bool = True,
        allow_private: bool = True,
        client: httpx.Client | None = None,
    ) -> None:
        super().__init__(
            base_url=base_url,
            model=model,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            max_response_chars=max_response_chars,
            allow_localhost=allow_localhost,
            allow_private=allow_private,
            client=client,
            capabilities=ModelCapabilities(
                text=True,
                vision=False,
                audio=False,
                structured_output=True,
                tool_calling=False,
            ),
        )

    def generate(self, request: TargetRequest) -> TargetResponse:
        try:
            return super().generate(request)
        except (TargetModelNotFoundError, TargetHTTPError) as exc:
            # Fallback to legacy llama.cpp /completion endpoint if /v1/chat/completions is 404
            if isinstance(exc, TargetModelNotFoundError) or (isinstance(exc, TargetHTTPError) and "404" in str(exc)):
                return self._generate_legacy_completion(request)
            raise

    def _generate_legacy_completion(self, request: TargetRequest) -> TargetResponse:
        """Fallback for legacy llama-server exposing /completion instead of /v1/chat/completions."""
        raw_base = self.base_url.removesuffix("/v1")
        endpoint = f"{raw_base}/completion"
        prompt = f"System: {request.system_prompt}\nUser: {request.user_prompt}\nAssistant:" if request.system_prompt else request.user_prompt
        payload = {
            "prompt": prompt,
            "n_predict": max(16, self.max_response_chars // 4),
            "temperature": request.temperature,
        }
        start = time.perf_counter()
        client, owned = self._http()
        try:
            resp = client.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout_seconds)
            if resp.status_code >= 400:
                raise TargetHTTPError(f"llama.cpp /completion returned HTTP {resp.status_code}.")
            data = resp.json()
            text = data.get("content") or data.get("completion") or ""
        except TargetError:
            raise
        except Exception as exc:
            raise TargetResponseError(f"llama.cpp legacy /completion request failed: {exc}") from exc
        finally:
            if owned:
                client.close()

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)
        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            provider=self.provider,
        )


# --------------------------------------------------------------------------- #
# 7. Local Hugging Face Transformers Pipeline Adapter
# --------------------------------------------------------------------------- #
class TransformersPipelineAdapter(ModelAdapter):
    """Adapter for local in-process Hugging Face Transformers pipelines."""

    name = "transformers"
    provider = "transformers"
    is_remote = False

    def __init__(
        self,
        model: str = "gpt2",
        max_response_chars: int = 4000,
        pipeline_instance: Any = None,
    ) -> None:
        self.model = model
        self.max_response_chars = max_response_chars
        self._pipeline = pipeline_instance
        self.capabilities = ModelCapabilities(text=True)

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        if self._pipeline is None:
            # Check if transformers is importable
            try:
                from transformers import pipeline  # type: ignore
                self._pipeline = pipeline("text-generation", model=self.model)
            except ImportError:
                raise TargetUnsupportedError(
                    "The 'transformers' and 'torch' libraries are not installed in the local Python environment. "
                    "Install transformers to run local in-process pipelines."
                )
            except Exception as exc:
                raise TargetConnectionError(f"Failed to initialize local Transformers pipeline: {exc}") from exc

        start = time.perf_counter()
        prompt = f"{request.system_prompt}\n{request.user_prompt}" if request.system_prompt else request.user_prompt
        try:
            outputs = self._pipeline(prompt, max_new_tokens=max(16, self.max_response_chars // 4))
            text = outputs[0].get("generated_text", "") if outputs else ""
        except Exception as exc:
            raise TargetError(f"Transformers pipeline execution failed: {exc}") from exc

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)

        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            provider=self.provider,
        )

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        if self._pipeline is not None:
            return ConnectionCheckResult(
                reachable=True,
                model_available=True,
                latency_ms=0,
                discovered_models=(self.model,),
                capabilities=self.capabilities,
            )
        try:
            import transformers  # noqa: F401
            return ConnectionCheckResult(
                reachable=True,
                model_available=True,
                latency_ms=0,
                discovered_models=(self.model,),
                capabilities=self.capabilities,
            )
        except ImportError:
            return ConnectionCheckResult(
                reachable=False,
                error_message="Transformers library is not installed in the Python environment.",
            )
