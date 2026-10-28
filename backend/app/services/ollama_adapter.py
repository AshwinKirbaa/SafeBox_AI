"""Adapter for Ollama's local HTTP API (POST /api/generate, GET /api/tags).

Never pulls models, never logs prompts or outputs. Any failure raises a
TargetError so the runner reports ERROR instead of a false pass.
"""
from __future__ import annotations

import json
import logging
import time

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
    TokenUsage,
    clamp_output,
)

logger = logging.getLogger("safebox.ollama")


class OllamaAdapter(ModelAdapter):
    name = "ollama"
    provider = "ollama"
    is_remote = False

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float,
        max_response_chars: int,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_response_chars = max_response_chars
        # Raw HTTP body cap: JSON envelope + up to 4 bytes/char of content.
        self.max_http_bytes = max_response_chars * 4 + 8192
        self._client = client

        is_vision = any(v in model.lower() for v in ("vision", "llava", "bakllava", "moondream", "minicpm"))
        self.capabilities = ModelCapabilities(
            text=True,
            vision=is_vision,
            audio=False,
            structured_output=True,
            tool_calling=True,
        )

    def _http(self) -> tuple[httpx.Client, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.Client(timeout=self.timeout_seconds, follow_redirects=False), True

    @staticmethod
    def _local_model_names(data: object) -> set[str]:
        """Return models backed by local weights, excluding Ollama cloud entries."""
        if not isinstance(data, dict) or not isinstance(data.get("models"), list):
            raise TargetResponseError("Ollama returned a malformed model inventory.")
        return {
            item["name"]
            for item in data["models"]
            if isinstance(item, dict)
            and isinstance(item.get("name"), str)
            and item["name"]
            and not item.get("remote_model")
            and not item.get("remote_host")
        }

    def _require_local_model(self) -> None:
        """Verify the requested model is installed before sending the test prompt."""
        client, owned = self._http()
        try:
            resp = client.get(f"{self.base_url}/api/tags", timeout=min(self.timeout_seconds, 5.0))
            if resp.status_code >= 400:
                raise TargetHTTPError(f"Ollama model inventory returned HTTP {resp.status_code}.")
            names = self._local_model_names(resp.json())
            wanted = {self.model, self.model if ":" in self.model else f"{self.model}:latest"}
            if not names.intersection(wanted):
                available = ", ".join(sorted(names)[:10]) or "none"
                raise TargetModelNotFoundError(
                    f"Ollama model '{self.model}' is not installed locally. "
                    f"Installed local models: {available}. Install it manually with "
                    f"'ollama pull {self.model}' (SafeBox never downloads models automatically)."
                )
        except TargetError:
            raise
        except httpx.TimeoutException as exc:
            raise TargetTimeout("Ollama model inventory request timed out.") from exc
        except httpx.TransportError as exc:
            raise TargetConnectionError(
                f"Could not connect to the Ollama service at {self.base_url}. "
                "Ensure Ollama is running (e.g. 'ollama serve' or open the Ollama app)."
            ) from exc
        except (ValueError, TypeError) as exc:
            raise TargetResponseError("Ollama returned a malformed model inventory.") from exc
        finally:
            if owned:
                client.close()

    def generate(self, request: TargetRequest) -> TargetResponse:
        self.validate_capabilities(request)
        self._require_local_model()
        payload: dict = {
            "model": self.model,
            "system": request.system_prompt,
            "prompt": request.user_prompt,
            "stream": False,
            "options": {"temperature": request.temperature, "num_predict": max(16, self.max_response_chars // 3)},
        }
        if request.images:
            payload["images"] = list(request.images)
        if request.schema_constraint:
            payload["format"] = "json"

        start = time.perf_counter()
        body = bytearray()
        max_attempts = 2
        for attempt in range(max_attempts):
            body.clear()
            client, owned = self._http()
            try:
                with client.stream("POST", f"{self.base_url}/api/generate", json=payload,
                                   timeout=self.timeout_seconds) as resp:
                    if resp.status_code == 404:
                        raise TargetModelNotFoundError(
                            f"Ollama returned HTTP 404. Ollama model '{self.model}' was not found on {self.base_url}. "
                            f"The model may not be installed; install it manually (e.g. 'ollama pull {self.model}') "
                            f"(SafeBox never downloads models)."
                        )
                    if resp.status_code >= 400:
                        raise TargetHTTPError(f"Ollama returned HTTP {resp.status_code}.")

                    for chunk in resp.iter_bytes():
                        body.extend(chunk)
                        if len(body) > self.max_http_bytes:
                            raise TargetResponseError("Ollama response exceeded the size limit.")
                        if time.perf_counter() - start > self.timeout_seconds:
                            raise TargetTimeout("Ollama inference exceeded the timeout.")
                break
            except TargetError:
                raise
            except httpx.TimeoutException as exc:
                raise TargetTimeout("Ollama request timed out.") from exc
            except httpx.TransportError as exc:
                if attempt < max_attempts - 1 and (time.perf_counter() - start) < (self.timeout_seconds - 2.0):
                    time.sleep(0.5)
                    continue
                raise TargetConnectionError(
                    f"Could not connect to the Ollama service at {self.base_url}. "
                    "Ensure Ollama is running (e.g. 'ollama serve' or open the Ollama app)."
                ) from exc
            finally:
                if owned:
                    client.close()

        try:
            data = json.loads(bytes(body))
            if isinstance(data, dict) and "response" in data:
                text = data["response"]
            elif isinstance(data, dict) and "message" in data and isinstance(data["message"], dict):
                text = data["message"].get("content", "")
            else:
                raise KeyError("response")
            if not isinstance(text, str):
                raise TypeError("content is not a string")
        except (ValueError, KeyError, TypeError) as exc:
            raise TargetResponseError("Ollama returned a malformed response.") from exc

        # Extract token usage if provided by Ollama
        prompt_tokens = data.get("prompt_eval_count") if isinstance(data, dict) else None
        completion_tokens = data.get("eval_count") if isinstance(data, dict) else None
        total_tokens = ((prompt_tokens or 0) + (completion_tokens or 0)) if (prompt_tokens or completion_tokens) else None
        usage = TokenUsage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens)

        text, truncated = clamp_output(text, self.max_response_chars)
        latency = int((time.perf_counter() - start) * 1000)
        logger.info("ollama call ok model=%s latency_ms=%d chars=%d", self.model, latency, len(text))
        return TargetResponse(
            text=text,
            truncated=truncated,
            adapter=self.name,
            model=self.model,
            latency_ms=latency,
            token_usage=usage,
            provider=self.provider,
        )

    def check_available(self, timeout_seconds: float = 2.0) -> tuple[bool, bool | None]:
        """(reachable, model_available). Uses GET /api/tags; never pulls anything."""
        client, owned = self._http()
        try:
            resp = client.get(f"{self.base_url}/api/tags", timeout=timeout_seconds)
            resp.raise_for_status()
            names = self._local_model_names(resp.json())
            wanted = {self.model, self.model if ":" in self.model else f"{self.model}:latest"}
            return True, bool(names & wanted)
        except (httpx.HTTPError, ValueError, AttributeError):
            return False, None
        finally:
            if owned:
                client.close()

    def discover_models(self, timeout_seconds: float = 2.0) -> list[str]:
        """Query installed models from GET /api/tags."""
        client, owned = self._http()
        try:
            resp = client.get(f"{self.base_url}/api/tags", timeout=timeout_seconds)
            resp.raise_for_status()
            return sorted(self._local_model_names(resp.json()))
        except Exception:
            return []
        finally:
            if owned:
                client.close()

    def check_connection(self, timeout_seconds: float = 2.0) -> ConnectionCheckResult:
        start = time.perf_counter()
        client, owned = self._http()
        try:
            resp = client.get(f"{self.base_url}/api/tags", timeout=timeout_seconds)
            resp.raise_for_status()
            models = sorted(self._local_model_names(resp.json()))
            wanted = {self.model, self.model if ":" in self.model else f"{self.model}:latest"}
            available = bool(set(models) & wanted) if self.model else True
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionCheckResult(
                reachable=True,
                model_available=available,
                latency_ms=latency,
                discovered_models=tuple(models),
                capabilities=self.capabilities,
            )
        except httpx.ConnectError:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Could not connect to Ollama service at {self.base_url}. Ensure Ollama is running ('ollama serve' or open the Ollama app).",
            )
        except httpx.TimeoutException:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Connection to Ollama at {self.base_url} timed out.",
            )
        except Exception as exc:
            return ConnectionCheckResult(
                reachable=False,
                error_message=f"Ollama connection check failed: {exc}",
            )
        finally:
            if owned:
                client.close()
