"""Type-aware, non-adversarial inference probes for saved model connections.

These probes validate an API contract without pretending that every model is a
chat model. They never log response bodies and return only bounded metadata.
"""
from __future__ import annotations

import io
import math
import time
import wave
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.schemas import ModelType
from app.services.security_network import sanitize_secrets_from_text, validate_endpoint_url


@dataclass(frozen=True)
class ProbeResult:
    ok: bool
    latency_ms: int
    details: dict[str, Any] = field(default_factory=dict)
    error_message: str | None = None
    error_kind: str | None = None
    http_status: int | None = None


def _url(base_url: str, suffix: str) -> str:
    return f"{base_url.rstrip('/')}/{suffix.lstrip('/')}"


def _standard_url(base_url: str, suffix: str) -> str:
    """Build an OpenAI-compatible operation URL from an API root or host root."""
    root = base_url.rstrip("/")
    if root.endswith("/v1"):
        return _url(root, suffix)
    return _url(f"{root}/v1", suffix)


def _headers(api_key: str | None, custom: dict[str, str] | None) -> dict[str, str]:
    result = {"Accept": "application/json", "User-Agent": "SafeBox-Model-Probe/1.0"}
    if api_key:
        result["Authorization"] = f"Bearer {api_key.strip()}"
    result.update(custom or {})
    return result


def _silent_wav() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\x00\x00" * 1600)
    return buf.getvalue()


def _extract_path(data: Any, path: str | None) -> Any:
    if not path:
        return data
    current = data
    for part in path.split("."):
        if isinstance(current, list) and part.isdigit():
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current[part]
        else:
            raise KeyError(path)
    return current


def probe_model(
    *, model_type: ModelType, base_url: str, model: str, api_key: str | None,
    custom_headers: dict[str, str] | None = None,
    request_template: dict[str, Any] | None = None,
    response_path: str | None = None,
    timeout_seconds: float = 30.0,
    allow_localhost: bool = False,
    allow_private: bool = False,
    client: httpx.Client | None = None,
) -> ProbeResult:
    valid, reason = validate_endpoint_url(base_url, allow_localhost=allow_localhost, allow_private=allow_private)
    if not valid:
        return ProbeResult(False, 0, error_message=f"SSRF policy blocked endpoint: {reason}", error_kind="connection")

    headers = _headers(api_key, custom_headers)
    endpoint = base_url
    payload: dict[str, Any] | None = None
    files = None
    expected = model_type.value

    if model_type == ModelType.embedding:
        endpoint = _standard_url(base_url, "embeddings")
        payload = {"model": model, "input": ["SafeBox verification sample A", "A different semantic sample B"]}
    elif model_type == ModelType.image_generation:
        endpoint = _standard_url(base_url, "images/generations")
        payload = {"model": model, "prompt": "A plain blue square on a white background", "n": 1, "size": "256x256"}
    elif model_type == ModelType.speech_to_text:
        endpoint = _standard_url(base_url, "audio/transcriptions")
        files = {"file": ("safebox-probe.wav", _silent_wav(), "audio/wav")}
        payload = {"model": model}
    elif model_type == ModelType.text_to_speech:
        endpoint = _standard_url(base_url, "audio/speech")
        payload = {"model": model, "input": "SafeBox verification", "voice": "alloy"}
    elif model_type == ModelType.reranking:
        endpoint = _standard_url(base_url, "rerank")
        payload = {"model": model, "query": "secure model evaluation", "documents": ["model security testing", "banana recipe"]}
    elif model_type in (ModelType.classification, ModelType.regression):
        endpoint = _standard_url(base_url, "predict")
        payload = request_template or {"model": model, "input": "SafeBox verification sample"}
    elif model_type == ModelType.custom:
        payload = request_template
        if payload is None:
            return ProbeResult(False, 0, error_message="Custom models require a JSON request template.", error_kind="configuration")
    else:
        return ProbeResult(False, 0, error_message=f"Use the security-test runner for {model_type.value} models.", error_kind="unsupported")

    started = time.perf_counter()
    owned = client is None
    http = client or httpx.Client(timeout=timeout_seconds, follow_redirects=False)
    try:
        if files:
            response = http.post(endpoint, data=payload, files=files, headers=headers, timeout=timeout_seconds)
        else:
            response = http.post(endpoint, json=payload, headers={**headers, "Content-Type": "application/json"}, timeout=timeout_seconds)
        latency = int((time.perf_counter() - started) * 1000)
        if response.status_code in (401, 403):
            return ProbeResult(False, latency, error_message=f"Authentication failed (HTTP {response.status_code}).", error_kind="authentication", http_status=response.status_code)
        if response.status_code == 404:
            return ProbeResult(False, latency, error_message=f"Model or {expected} endpoint not found (HTTP 404).", error_kind="model_not_found", http_status=404)
        if response.status_code == 429:
            return ProbeResult(False, latency, error_message="Rate limit exceeded (HTTP 429).", error_kind="rate_limit", http_status=429)
        if response.status_code >= 400:
            return ProbeResult(False, latency, error_message=f"Provider returned HTTP {response.status_code}.", error_kind="http_error", http_status=response.status_code)
        if len(response.content) > 5 * 1024 * 1024:
            return ProbeResult(False, latency, error_message="Model probe response exceeded the 5 MiB safety limit.", error_kind="invalid_response")

        if model_type == ModelType.text_to_speech:
            size = len(response.content)
            ok = size >= 128
            return ProbeResult(ok, latency, {"audio_bytes": size, "content_type": response.headers.get("content-type", "unknown")}, None if ok else "Provider returned an empty/invalid audio response.", None if ok else "invalid_response")

        data = response.json()
        value = _extract_path(data, response_path)
        details: dict[str, Any] = {}
        ok = True
        if model_type == ModelType.embedding:
            items = value.get("data", []) if isinstance(value, dict) else []
            vectors = [i.get("embedding") for i in items if isinstance(i, dict)]
            finite = len(vectors) >= 1 and all(isinstance(v, list) and v and all(isinstance(x, (int, float)) and math.isfinite(x) for x in v) for v in vectors)
            dimensions = [len(v) for v in vectors if isinstance(v, list)]
            consistent = bool(dimensions) and len(set(dimensions)) == 1
            distinct = len(vectors) >= 2 and vectors[0] != vectors[1]
            ok = finite and consistent and distinct
            details = {
                "vectors": len(vectors),
                "dimensions": dimensions[0] if dimensions else 0,
                "finite_values": finite,
                "consistent_dimensions": consistent,
                "distinct_inputs_differ": distinct,
            }
        elif model_type == ModelType.image_generation:
            items = value.get("data", []) if isinstance(value, dict) else []
            ok = bool(items) and isinstance(items[0], dict) and bool(items[0].get("url") or items[0].get("b64_json"))
            details = {"images": len(items), "image_payload_present": ok}
        elif model_type == ModelType.speech_to_text:
            text = value.get("text") if isinstance(value, dict) else None
            ok = isinstance(text, str)
            details = {"transcript_returned": ok, "transcript_chars": len(text or "")}
        elif model_type == ModelType.reranking:
            results = value.get("results", value.get("data", [])) if isinstance(value, dict) else value
            ok = isinstance(results, list) and len(results) > 0
            details = {"ranked_items": len(results) if isinstance(results, list) else 0}
        elif model_type == ModelType.classification:
            candidate = value.get("label", value.get("labels")) if isinstance(value, dict) else value
            ok = isinstance(candidate, (str, list, dict))
            details = {"label_contract_valid": ok}
        elif model_type == ModelType.regression:
            candidate = value.get("value", value.get("prediction")) if isinstance(value, dict) else value
            ok = isinstance(candidate, (int, float)) and math.isfinite(candidate)
            details = {"finite_numeric_prediction": ok}
        else:
            ok = value is not None
            details = {"response_path_resolved": ok, "response_type": type(value).__name__}
        return ProbeResult(ok, latency, details, None if ok else f"Response did not match the {expected} contract.", None if ok else "invalid_response")
    except httpx.TimeoutException:
        latency = int((time.perf_counter() - started) * 1000)
        return ProbeResult(
            False,
            latency,
            details={"timeout_seconds": timeout_seconds, "request_sent": True},
            error_message=(
                f"Model probe timed out after {timeout_seconds:g} seconds. "
                "The provider may be cold-starting, queued, overloaded, or unavailable; retry once or select another route."
            ),
            error_kind="timeout",
        )
    except httpx.TransportError as exc:
        return ProbeResult(False, int((time.perf_counter() - started) * 1000), error_message=f"Connection failed: {sanitize_secrets_from_text(str(exc), api_key)}", error_kind="connection")
    except (ValueError, KeyError, TypeError) as exc:
        return ProbeResult(False, int((time.perf_counter() - started) * 1000), error_message=f"Malformed {expected} response: {type(exc).__name__}.", error_kind="invalid_response")
    finally:
        if owned:
            http.close()
