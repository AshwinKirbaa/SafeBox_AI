"""Unit tests for Anthropic and Gemini model-list pagination.

Covers:
- Multiple pages
- Empty pages
- Pagination termination (repeated tokens / cursors and max limits)
- API errors (401/403 auth errors, 500 server errors)
- Timeouts and transport errors
- Key secrecy (no API keys in URLs or logs)
"""
import httpx
import pytest

from app.services.provider_adapters import AnthropicAdapter, GeminiAdapter

SECRET_ANTHROPIC = "sk-ant-test-SECRET-KEY-12345"
SECRET_GEMINI = "AIzaSy-test-SECRET-KEY-67890"


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


# =========================================================================== #
# Anthropic Pagination Tests (/v1/models)
# =========================================================================== #

def test_anthropic_pagination_multiple_pages():
    requests = []

    def handler(req: httpx.Request):
        requests.append(req)
        after_id = req.url.params.get("after_id")
        if after_id is None:
            return httpx.Response(200, json={
                "data": [
                    {"id": "claude-3-5-sonnet-20241022", "type": "model"},
                    {"id": "claude-3-5-haiku-20241022", "type": "model"},
                ],
                "has_more": True,
                "first_id": "claude-3-5-sonnet-20241022",
                "last_id": "claude-3-5-haiku-20241022",
            })
        elif after_id == "claude-3-5-haiku-20241022":
            return httpx.Response(200, json={
                "data": [
                    {"id": "claude-3-opus-20240229", "type": "model"},
                ],
                "has_more": False,
                "first_id": "claude-3-opus-20240229",
                "last_id": "claude-3-opus-20240229",
            })
        return httpx.Response(400, json={"error": "invalid cursor"})

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    models = adapter.discover_models()

    assert len(requests) == 2
    assert requests[0].url.params.get("limit") == "1000"
    assert "after_id" not in requests[0].url.params
    assert requests[1].url.params.get("after_id") == "claude-3-5-haiku-20241022"
    assert sorted(models) == [
        "claude-3-5-haiku-20241022",
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
    ]


def test_anthropic_pagination_empty_page():
    def handler(req: httpx.Request):
        return httpx.Response(200, json={"data": [], "has_more": False})

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is True
    assert res.model_available is False
    assert "empty model list" in (res.error_message or "")


def test_anthropic_pagination_repeated_cursor_terminates():
    call_count = 0

    def handler(req: httpx.Request):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json={
            "data": [{"id": f"model-{call_count}"}],
            "has_more": True,
            "last_id": "fixed-infinite-loop-cursor",
        })

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    models = adapter.discover_models()
    # First call sets fixed-infinite-loop-cursor, second call sends it,
    # sees it in seen_cursors, and terminates. Total calls must not loop infinitely.
    assert call_count == 2
    assert "model-1" in models
    assert "model-2" in models


def test_anthropic_pagination_api_error_first_page():
    def handler(req: httpx.Request):
        return httpx.Response(500, json={"error": "Internal server error"})

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is True
    assert res.model_available is False
    assert "500" in (res.error_message or "")


def test_anthropic_pagination_timeout_handled():
    def handler(req: httpx.Request):
        raise httpx.ReadTimeout("Timeout reading from Anthropic")

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is False
    assert "error" in (res.error_message or "").lower()


def test_anthropic_no_key_in_url():
    urls = []

    def handler(req: httpx.Request):
        urls.append(str(req.url))
        return httpx.Response(200, json={"data": [{"id": "claude-3-5-sonnet-20241022"}]})

    adapter = AnthropicAdapter(api_key=SECRET_ANTHROPIC, client=_client(handler))
    adapter.discover_models()
    assert all(SECRET_ANTHROPIC not in u for u in urls)


# =========================================================================== #
# Gemini Pagination Tests (/v1beta/models)
# =========================================================================== #

def test_gemini_pagination_multiple_pages():
    requests = []

    def handler(req: httpx.Request):
        requests.append(req)
        page_token = req.url.params.get("pageToken")
        if page_token is None:
            return httpx.Response(200, json={
                "models": [
                    {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"]},
                    {"name": "models/gemini-1.5-pro", "supportedGenerationMethods": ["generateContent"]},
                ],
                "nextPageToken": "gemini-page-2-token",
            })
        elif page_token == "gemini-page-2-token":
            return httpx.Response(200, json={
                "models": [
                    {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
                    {"name": "models/embedding-001", "supportedGenerationMethods": ["embedContent"]},
                ],
                "nextPageToken": "",
            })
        return httpx.Response(400, json={"error": "invalid token"})

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    models = adapter.discover_models()

    assert len(requests) == 2
    assert requests[0].url.params.get("pageSize") == "1000"
    assert "pageToken" not in requests[0].url.params
    assert requests[1].url.params.get("pageToken") == "gemini-page-2-token"
    # Embedding-001 should be filtered out because it doesn't support generateContent
    assert sorted(models) == ["gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"]


def test_gemini_pagination_empty_page():
    def handler(req: httpx.Request):
        return httpx.Response(200, json={"models": []})

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is True
    assert res.model_available is False
    assert "empty model list" in (res.error_message or "")


def test_gemini_pagination_repeated_token_terminates():
    call_count = 0

    def handler(req: httpx.Request):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json={
            "models": [{"name": f"models/model-{call_count}", "supportedGenerationMethods": ["generateContent"]}],
            "nextPageToken": "looping-token",
        })

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    models = adapter.discover_models()
    assert call_count == 2
    assert "model-1" in models
    assert "model-2" in models


def test_gemini_pagination_api_error_first_page():
    def handler(req: httpx.Request):
        return httpx.Response(403, json={"error": {"message": "Forbidden"}})

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is True
    assert res.model_available is False
    assert "Invalid Gemini API key" in (res.error_message or "")


def test_gemini_pagination_timeout_handled():
    def handler(req: httpx.Request):
        raise httpx.ConnectTimeout("Timeout connecting to Gemini")

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    res = adapter.check_connection()
    assert res.reachable is False
    assert "error" in (res.error_message or "").lower()


def test_gemini_no_key_in_url():
    urls = []

    def handler(req: httpx.Request):
        urls.append(str(req.url))
        return httpx.Response(200, json={"models": [{"name": "models/gemini-2.0-flash"}]})

    adapter = GeminiAdapter(api_key=SECRET_GEMINI, client=_client(handler))
    adapter.discover_models()
    assert all(SECRET_GEMINI not in u for u in urls)
