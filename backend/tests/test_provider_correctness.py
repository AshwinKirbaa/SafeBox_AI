"""Regression tests for provider adapter defects found in the correctness audit.

All tests use httpx.MockTransport: no network, no paid API, no real credentials.
"""
import json
import logging

import httpx
import pytest

from app.services.model_adapter import TargetRequest
from app.services.provider_adapters import AnthropicAdapter, GeminiAdapter, HuggingFaceAdapter

SECRET = "sk-test-SECRET-1234567890"


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


# --- Anthropic: Messages API request/response mapping --------------------------------- #
def test_anthropic_request_matches_messages_api():
    seen = {}

    def handler(req: httpx.Request):
        seen["url"] = str(req.url)
        seen["headers"] = req.headers
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={
            "content": [{"type": "text", "text": "ok"}],
            "usage": {"input_tokens": 7, "output_tokens": 3},
        })

    adapter = AnthropicAdapter(api_key=SECRET, model="claude-3-5-sonnet-20241022", client=_client(handler))
    res = adapter.generate(TargetRequest("be safe", "hello"))
    assert seen["url"] == "https://api.anthropic.com/v1/messages"
    assert seen["headers"]["x-api-key"] == SECRET
    assert seen["headers"]["anthropic-version"] == "2023-06-01"
    body = seen["body"]
    assert body["model"] == "claude-3-5-sonnet-20241022"
    assert body["system"] == "be safe"  # system is top-level, not a message role
    assert body["messages"] == [{"role": "user", "content": [{"type": "text", "text": "hello"}]}]
    assert isinstance(body["max_tokens"], int) and body["max_tokens"] > 0
    assert (res.token_usage.prompt_tokens, res.token_usage.completion_tokens,
            res.token_usage.total_tokens) == (7, 3, 10)
    assert res.provider == "anthropic" and res.model == "claude-3-5-sonnet-20241022"


def test_anthropic_error_messages_do_not_leak_key():
    adapter = AnthropicAdapter(api_key=SECRET, client=_client(lambda r: httpx.Response(500, text=SECRET)))
    with pytest.raises(Exception) as ei:
        adapter.generate(TargetRequest("s", "u"))
    assert SECRET not in str(ei.value)


# --- A failed health probe must never report the model as available ------------------ #
@pytest.mark.parametrize("status", [429, 500, 503])
def test_anthropic_check_connection_unexpected_status_is_not_available(status):
    adapter = AnthropicAdapter(api_key=SECRET, client=_client(lambda r: httpx.Response(status, json={})))
    res = adapter.check_connection()
    assert res.model_available is False
    assert str(status) in (res.error_message or "")


def test_anthropic_model_listing_requests_full_page():
    seen = {}

    def handler(req):
        seen["params"] = dict(req.url.params)
        return httpx.Response(200, json={"data": [{"id": "claude-3-5-sonnet-20241022"}]})

    AnthropicAdapter(api_key=SECRET, client=_client(handler)).discover_models()
    # Anthropic paginates /v1/models (default 20); without limit a valid model can look missing.
    assert seen["params"].get("limit") == "1000"


@pytest.mark.parametrize("status", [429, 500, 503])
def test_gemini_check_connection_unexpected_status_is_not_available(status):
    adapter = GeminiAdapter(api_key=SECRET, client=_client(lambda r: httpx.Response(status, json={})))
    res = adapter.check_connection()
    assert res.model_available is False
    assert str(status) in (res.error_message or "")


@pytest.mark.parametrize("status", [429, 500, 503])
def test_huggingface_check_connection_unexpected_status_is_not_available(status):
    adapter = HuggingFaceAdapter(api_key=SECRET, client=_client(lambda r: httpx.Response(status, json={})))
    res = adapter.check_connection()
    assert res.model_available is False
    assert str(status) in (res.error_message or "")


# --- Gemini: API key must travel in a header, never in the URL ----------------------- #
def test_gemini_key_never_in_url_or_logs(caplog):
    urls = []

    def handler(req: httpx.Request):
        urls.append(str(req.url))
        if req.url.path.endswith(":generateContent"):
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "hi"}]}}]})
        return httpx.Response(200, json={"models": [{"name": "models/gemini-2.0-flash"}]})

    adapter = GeminiAdapter(api_key=SECRET, model="gemini-2.0-flash", client=_client(handler))
    with caplog.at_level(logging.DEBUG):
        adapter.generate(TargetRequest("s", "u"))
        adapter.check_connection()
        adapter.discover_models()
    assert urls and all(SECRET not in u for u in urls)
    assert SECRET not in caplog.text
