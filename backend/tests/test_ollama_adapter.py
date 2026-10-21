import json

import httpx
import pytest

from app.services.model_adapter import (TargetConnectionError, TargetHTTPError, TargetRequest,
                                        TargetResponseError, TargetTimeout)
from app.services.ollama_adapter import OllamaAdapter

REQ = TargetRequest("sys", "user")


def adapter(handler, max_chars=200, timeout=5.0):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return OllamaAdapter("http://127.0.0.1:11434", "llama3.2:3b", timeout, max_chars, client)


def ok(content="hello"):
    return lambda req: httpx.Response(200, json={"response": content, "done": True})


def test_success_and_request_shape():
    seen = {}

    def handler(req):
        seen["url"], seen["body"] = str(req.url), json.loads(req.content)
        return httpx.Response(200, json={"response": "hi", "done": True})

    r = adapter(handler).generate(REQ)
    assert r.text == "hi" and not r.truncated and r.adapter == "ollama"
    assert seen["url"] == "http://127.0.0.1:11434/api/generate"
    assert seen["body"]["stream"] is False and seen["body"]["model"] == "llama3.2:3b"
    assert seen["body"]["system"] == "sys" and seen["body"]["prompt"] == "user"


def test_never_calls_pull_endpoint():
    paths = []

    def handler(req):
        paths.append(req.url.path)
        return httpx.Response(404, json={"error": "model not found"})

    with pytest.raises(TargetHTTPError, match="never downloads"):
        adapter(handler).generate(REQ)
    assert paths == ["/api/generate"]


def test_connection_error():
    def handler(req):
        raise httpx.ConnectError("refused")

    with pytest.raises(TargetConnectionError):
        adapter(handler).generate(REQ)


def test_timeout_error():
    def handler(req):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(TargetTimeout):
        adapter(handler).generate(REQ)


def test_http_500():
    with pytest.raises(TargetHTTPError):
        adapter(lambda r: httpx.Response(500, text="boom")).generate(REQ)


@pytest.mark.parametrize("resp", [
    httpx.Response(200, text="not json"),
    httpx.Response(200, json={"unexpected": 1}),
    httpx.Response(200, json={"message": {"content": 123}}),
    httpx.Response(200, json=["list"]),
])
def test_malformed_responses(resp):
    with pytest.raises(TargetResponseError):
        adapter(lambda r: resp).generate(REQ)


def test_long_content_truncated_and_flagged():
    r = adapter(ok("x" * 1000), max_chars=100).generate(REQ)
    assert len(r.text) == 100 and r.truncated


def test_oversized_http_body_rejected():
    with pytest.raises(TargetResponseError, match="size limit"):
        adapter(ok("x" * 20000), max_chars=100).generate(REQ)


def test_check_available():
    def handler(req):
        assert req.url.path == "/api/tags"
        return httpx.Response(200, json={"models": [{"name": "llama3.2:3b"}]})

    assert adapter(handler).check_available() == (True, True)

    def down(req):
        raise httpx.ConnectError("x")

    assert adapter(down).check_available() == (False, None)
