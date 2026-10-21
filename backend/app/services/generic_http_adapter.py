"""Generic HTTP JSON inference adapter.

Allows testing custom or proprietary model APIs by configuring arbitrary
request body templates, custom headers, and response JSON path extractions.
Enforces SSRF protections and size limits.
"""
from __future__ import annotations

import copy
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
    clamp_output,
)
from app.services.security_network import sanitize_secrets_from_text, validate_endpoint_url

logger = logging.getLogger("safebox.generic_http")


def _render_template(node: Any, variables: dict[str, str]) -> Any:
    """Recursively replace placeholder tags {{var}} in strings within nested structures."""
    if isinstance(node, str):
        result = node
        for k, v in variables.items():
            result = result.replace(f"{{{{{k}}}}}", v)
        return result
    if isinstance(node, dict):
        return {k: _render_template(v, variables) for k, v in node.items()}
    if isinstance(node, list):
        return [_render_template(item, variables) for item in node]
    return node


def _extract_by_path(data: Any, path: str) -> Any:
    """Extract nested value by dot-notation path, e.g. 'choices.0.message.content'."""
    tokens = path.split(".")
    curr = data
    for token in tokens:
        if curr is None:
            return None
        if isinstance(curr, dict):
            curr = curr.get(token)
        elif isinstance(curr, list):
            try:
                idx = int(token)
                curr = curr[idx] if 0 <= idx < len(curr) else None
            except ValueError:
                return None
        else:
            return None
    return curr


def _extract_text_heuristic(data: Any) -> str | None:
    """Fallback search for common response keys if no path is configured or path misses."""
    if isinstance(data, str):
        return data
    if isinstance(data, list) and data:
        return _extract_text_heuristic(data[0])
    if isinstance(data, dict):
        for candidate in ("response", "text", "generated_text", "output", "content", "completion"):
            if candidate in data and isinstance(data[candidate], str):
                return data[candidate]
        # Check choices array
        if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
            first = data["choices"][0]
            if isinstance(first, dict):
                if "text" in first and isinstance(first["text"], str):
                    return first["text"]
                if "message" in first and isinstance(first["message"], dict):
                    content = first["message"].get("content")
                    if isinstance(content, str):
                        return content
    return None


class GenericHTTPAdapter(ModelAdapter):
    name = "generic_http"
    provider = "generic_http"
    is_remote = True

    def __init__(
        self,
        endpoint_url: str,
        model: str = "generic-model",
        method: str = "POST",
        headers: dict[str, str] | None = None,
        request_template: dict[str, Any] | None = None,
        response_path: str | None = None,
        timeout_seconds: float = 30.0,
        max_response_chars: int = 4000,
        allow_localhost: bool = False,
        allow_private: bool = False,
        client: httpx.Client | None = None,
        capabilities: ModelCapabilities | None = None,
    ) -> None:
        self.endpoint_url = endpoint_url.strip()
        self.model = model
        self.method = method.upper()
        self.headers = headers or {}
        self.request_template = request_template
        self.response_path = response_path
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        self.max_http_bytes = max_response_chars * 4 + 16384
        self.allow_localhost = allow_localhost
        self.allow_private = allow_private
        self._client = client
        self.capabilities = capabilities or ModelCapabilities(text=True)

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    def _build_payload(self, request: TargetRequest) -> dict[str, Any]:
        vars_map = {
            "system_prompt": request.system_prompt,
            "user_prompt": request.user_prompt,
            "model": self.model,
        }
        if self.request_template:
            return _render_template(copy.deepcopy(self.request_template), vars_map)

        # Default fallback JSON structure
        return {
            "model": self.model,
            "prompt": f"{request.system_prompt}\n\n{request.user_prompt}" if request.system_prompt else request.user_prompt,
            "temperature": request.temperature,
        }

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)

        valid, err = validate_endpoint_url(
            self.endpoint_url,
            allow_localhost=self.allow_localhost,
            allow_private=self.allow_private,
        )
        if not valid:
            raise TargetConnectionError(f"SSRF policy blocked request: {err}")

        payload = self._build_payload(request)
        merged_headers = {"Content-Type": "application/json", "User-Agent": "SafeBox-Security-Auditor/1.0"}
        merged_headers.update(self.headers)

        start = time.perf_counter()
        client, owned = self._http()
        body = bytearray()

        try:
            with client.stream(self.method, self.endpoint_url, json=payload,
                               headers=merged_headers, timeout=self.timeout_seconds) as resp:
                if resp.status_code == 401 or resp.status_code == 403:
                    raise TargetAuthError(f"Endpoint authentication failed (HTTP {resp.status_code}).")
                if resp.status_code == 404:
                    raise TargetModelNotFoundError(f"Endpoint returned HTTP 404: Not Found.")
                if resp.status_code == 429:
                    raise TargetRateLimitError(f"Endpoint rate limit exceeded (HTTP 429).")
                if resp.status_code >= 400:
                    raise TargetHTTPError(f"Endpoint returned HTTP {resp.status_code}.")

                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > self.max_http_bytes:
                        raise TargetResponseError("Endpoint response exceeded configured size limit.")
                    if time.perf_counter() - start > self.timeout_seconds:
                        raise TargetTimeout("Endpoint inference timed out.")
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Endpoint connection timed out.") from exc
        except httpx.TransportError as exc:
            clean_msg = sanitize_secrets_from_text(str(exc))
            raise TargetConnectionError(f"Could not connect to custom HTTP endpoint: {clean_msg}") from exc
        finally:
            if owned:
                client.close()

        try:
            data = json.loads(bytes(body))
        except ValueError as exc:
            raise TargetResponseError(f"Endpoint did not return valid JSON: {exc}") from exc

        text = None
        if self.response_path:
            val = _extract_by_path(data, self.response_path)
            if isinstance(val, str):
                text = val
            elif val is not None:
                text = str(val)

        if text is None:
            text = _extract_text_heuristic(data)

        if text is None:
            raise TargetResponseError(
                f"Failed to extract text output from response using response_path '{self.response_path}'."
            )

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
        """Check reachability by issuing a lightweight HEAD/GET request or validating URL."""
        valid, reason = validate_endpoint_url(
            self.endpoint_url,
            allow_localhost=self.allow_localhost,
            allow_private=self.allow_private,
        )
        if not valid:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"SSRF Policy Violation: {reason}",
            )

        start = time.perf_counter()
        client, owned = self._http()
        try:
            # Send HEAD or lightweight GET request
            resp = client.request("HEAD", self.endpoint_url, headers=self.headers, timeout=timeout_seconds)
            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code == 405:  # Method not allowed for HEAD, try GET or assume reachable
                resp = client.request("GET", self.endpoint_url, headers=self.headers, timeout=timeout_seconds)
                latency = int((time.perf_counter() - start) * 1000)

            if resp.status_code == 401 or resp.status_code == 403:
                return ConnectionCheckResult(
                    reachable=True,
                    model_available=False,
                    latency_ms=latency,
                    error_message=f"Authentication required or failed (HTTP {resp.status_code}).",
                )

            return ConnectionCheckResult(
                reachable=resp.status_code < 500,
                model_available=True if resp.status_code < 400 else False,
                latency_ms=latency,
                discovered_models=(self.model,) if self.model else (),
                capabilities=self.capabilities,
            )
        except httpx.ConnectError:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Could not connect to {self.endpoint_url}.",
            )
        except httpx.TimeoutException:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Connection to {self.endpoint_url} timed out.",
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

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        return [self.model] if self.model else []
