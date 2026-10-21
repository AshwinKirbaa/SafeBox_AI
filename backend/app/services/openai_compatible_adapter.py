"""Universal OpenAI-compatible chat-completions API adapter.

Works with any server implementing the OpenAI /v1/chat/completions specification,
including OpenAI, vLLM, LocalAI, LM Studio, Ollama OpenAI compatibility endpoint,
TGI, FastChat, and cloud gateways.
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
from app.services.security_network import sanitize_secrets_from_text, validate_endpoint_url

logger = logging.getLogger("safebox.openai_compatible")


class OpenAICompatibleAdapter(ModelAdapter):
    name = "openai_compatible"
    provider = "openai_compatible"
    is_remote = True

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        extra_headers: dict[str, str] | None = None,
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        allow_localhost: bool = False,
        allow_private: bool = False,
        client: httpx.Client | None = None,
        capabilities: ModelCapabilities | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.extra_headers = extra_headers or {}
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        self.max_http_bytes = max_response_chars * 4 + 16384
        self.allow_localhost = allow_localhost
        self.allow_private = allow_private
        self._client = client

        # Set capabilities (defaulting to text, vision, structured output, and tool calling)
        self.capabilities = capabilities or ModelCapabilities(
            text=True,
            vision=True,
            audio=False,
            structured_output=True,
            tool_calling=True,
        )

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "SafeBox-Security-Auditor/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key.strip()}"
        headers.update(self.extra_headers)
        return headers

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    def _build_payload(self, request: TargetRequest) -> dict[str, Any]:
        messages: list[dict[str, Any]] = []

        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})

        if request.images:
            content_parts: list[dict[str, Any]] = [{"type": "text", "text": request.user_prompt}]
            for img in request.images:
                url = img if img.startswith(("http://", "https://", "data:")) else f"data:image/jpeg;base64,{img}"
                content_parts.append({"type": "image_url", "image_url": {"url": url}})
            messages.append({"role": "user", "content": content_parts})
        else:
            messages.append({"role": "user", "content": request.user_prompt})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": max(16, self.max_response_chars // 3),
        }

        if request.tools:
            payload["tools"] = list(request.tools)
        if request.schema_constraint:
            payload["response_format"] = {"type": "json_object"}

        return payload

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        # Validate URL for SSRF protection
        valid, err = validate_endpoint_url(
            self.base_url,
            allow_localhost=self.allow_localhost,
            allow_private=self.allow_private,
        )
        if not valid:
            raise TargetConnectionError(f"SSRF policy blocked request to endpoint: {err}")

        payload = self._build_payload(request)
        endpoint = f"{self.base_url}/chat/completions" if "/v1" in self.base_url else f"{self.base_url}/v1/chat/completions"

        start = time.perf_counter()
        client, owned = self._http()
        headers = self._get_headers()
        body = bytearray()

        try:
            with client.stream("POST", endpoint, json=payload, headers=headers,
                               timeout=self.timeout_seconds) as resp:
                if resp.status_code == 401 or resp.status_code == 403:
                    raise TargetAuthError(
                        f"Authentication failed (HTTP {resp.status_code}) on provider endpoint. "
                        "Check your API key configuration."
                    )
                if resp.status_code == 404:
                    raise TargetModelNotFoundError(
                        f"Model '{self.model}' was not found on target provider (HTTP 404)."
                    )
                if resp.status_code == 429:
                    raise TargetRateLimitError("Rate limit exceeded on target provider (HTTP 429).")
                if resp.status_code >= 400:
                    raise TargetHTTPError(f"Target provider returned HTTP {resp.status_code}.")

                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_http_bytes:
                        raise TargetResponseError("Target provider response exceeded maximum size limit.")
                    if time.perf_counter() - start > self.timeout_seconds:
                        raise TargetTimeout("Inference exceeded the configured timeout.")
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Connection to inference provider timed out.") from exc
        except httpx.TransportError as exc:
            clean_msg = sanitize_secrets_from_text(str(exc))
            raise TargetConnectionError(f"Could not connect to target provider: {clean_msg}") from exc
        finally:
            if owned:
                client.close()

        try:
            data = json.loads(bytes(body))
            if not isinstance(data, dict):
                raise TypeError("Response root must be a JSON object")

            choices = data.get("choices")
            if not isinstance(choices, list) or len(choices) == 0:
                raise KeyError("Missing or empty 'choices' list in response")

            first_choice = choices[0]
            message = first_choice.get("message", {})
            text = message.get("content") or ""
            tool_calls = message.get("tool_calls") or []

            # In tool calling responses, text might be empty if tool_calls were emitted
            if not text and tool_calls:
                text = f"Tool calls: {json.dumps(tool_calls)}"

            if not isinstance(text, str):
                raise TypeError("message.content is not a string")
        except (ValueError, KeyError, TypeError) as exc:
            raise TargetResponseError(f"Malformed JSON response from OpenAI-compatible provider: {exc}") from exc

        # Extract token usage if provided
        usage_data = data.get("usage", {})
        usage = None
        if isinstance(usage_data, dict) and any(k in usage_data for k in ("prompt_tokens", "completion_tokens", "total_tokens")):
            usage = TokenUsage(
                prompt_tokens=usage_data.get("prompt_tokens"),
                completion_tokens=usage_data.get("completion_tokens"),
                total_tokens=usage_data.get("total_tokens"),
            )

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
            tool_calls=tuple(tool_calls) if tool_calls else (),
        )

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        """Discover available models via GET /v1/models (never sends prompt inference)."""
        valid, _ = validate_endpoint_url(
            self.base_url,
            allow_localhost=self.allow_localhost,
            allow_private=self.allow_private,
        )
        if not valid:
            return []

        endpoint = f"{self.base_url}/models" if "/v1" in self.base_url else f"{self.base_url}/v1/models"
        client, owned = self._http()
        try:
            resp = client.get(endpoint, headers=self._get_headers(), timeout=timeout_seconds)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data", []) if isinstance(data, dict) else []
                models = [item.get("id") for item in items if isinstance(item, dict) and item.get("id")]
                return sorted(models)
            return []
        except Exception:
            return []
        finally:
            if owned:
                client.close()

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        """Probe reachability and model existence via GET /v1/models."""
        valid, reason = validate_endpoint_url(
            self.base_url,
            allow_localhost=self.allow_localhost,
            allow_private=self.allow_private,
        )
        if not valid:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"SSRF Policy Violation: {reason}",
            )

        start = time.perf_counter()
        endpoint = f"{self.base_url}/models" if "/v1" in self.base_url else f"{self.base_url}/v1/models"
        client, owned = self._http()
        try:
            resp = client.get(endpoint, headers=self._get_headers(), timeout=timeout_seconds)
            latency = int((time.perf_counter() - start) * 1000)

            if resp.status_code == 401 or resp.status_code == 403:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message=f"Authentication failed (HTTP {resp.status_code}). Verify API key.",
                )
            if resp.status_code >= 400:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message=f"Endpoint returned HTTP {resp.status_code}.",
                )

            data = resp.json()
            items = data.get("data", []) if isinstance(data, dict) else []
            models = [item.get("id") for item in items if isinstance(item, dict) and item.get("id")]
            model_exists = self.model in models if self.model and models else True

            return ConnectionCheckResult(
                reachable=True,
                model_available=model_exists,
                latency_ms=latency,
                discovered_models=tuple(models),
                capabilities=self.capabilities,
            )
        except httpx.ConnectError:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Could not connect to service at {self.base_url}.",
            )
        except httpx.TimeoutException:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Connection to service at {self.base_url} timed out.",
            )
        except Exception as exc:
            clean_msg = sanitize_secrets_from_text(str(exc))
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Connection check error: {clean_msg}",
            )
        finally:
            if owned:
                client.close()
