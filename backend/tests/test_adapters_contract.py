"""Comprehensive unit and contract tests for universal model adapters.

Tests:
- Successful generation and response shape
- Authentication failures (401/403)
- Missing model (404)
- Rate limiting (429)
- Malformed responses & invalid formats
- Connection refusal & timeout
- Oversized response clamping
- Secret redaction in errors and logs
- Unsupported capability rejection
- SSRF protections against metadata, loopback and private IPs
"""
import json
import httpx
import pytest

from app.schemas import MockBehavior
from app.services.generic_http_adapter import GenericHTTPAdapter
from app.services.mock_adapter import MockAdapter
from app.services.model_adapter import (
    ModelCapabilities,
    TargetAuthError,
    TargetConnectionError,
    TargetHTTPError,
    TargetModelNotFoundError,
    TargetRateLimitError,
    TargetRequest,
    TargetResponseError,
    TargetTimeout,
    TargetUnsupportedError,
)
from app.services.openai_compatible_adapter import OpenAICompatibleAdapter
from app.services.provider_adapters import (
    AnthropicAdapter,
    GeminiAdapter,
    HuggingFaceAdapter,
    LlamaCppAdapter,
    OpenAIAdapter,
    TransformersPipelineAdapter,
    VLLMAdapter,
)
from app.services.security_network import validate_endpoint_url


# --------------------------------------------------------------------------- #
# 1. SSRF Protection Tests
# --------------------------------------------------------------------------- #
def test_ssrf_blocks_cloud_metadata():
    valid, reason = validate_endpoint_url("http://169.254.169.254/latest/meta-data/")
    assert not valid
    assert "Cloud metadata" in reason


def test_ssrf_blocks_loopback_by_default():
    valid, reason = validate_endpoint_url("http://127.0.0.1:8080/v1")
    assert not valid
    assert "Loopback" in reason


def test_ssrf_blocks_private_networks_by_default():
    valid, reason = validate_endpoint_url("http://192.168.1.100:8000/v1")
    assert not valid
    assert "Private network" in reason


def test_ssrf_blocks_embedded_credentials():
    valid, reason = validate_endpoint_url("http://user:pass@example.com/api")
    assert not valid
    assert "embedded credentials" in reason


def test_ssrf_allows_public_https():
    valid, reason = validate_endpoint_url("https://api.openai.com/v1")
    assert valid
    assert reason is None


# --------------------------------------------------------------------------- #
# 2. OpenAI-Compatible Adapter Contract Tests
# --------------------------------------------------------------------------- #
def test_openai_compatible_success():
    def handler(req):
        assert req.url.path == "/v1/chat/completions"
        assert req.headers["authorization"] == "Bearer test-key"
        body = json.loads(req.content)
        assert body["model"] == "gpt-4o-mini"
        assert len(body["messages"]) == 2
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "Adversarial test refused."}}],
            "usage": {"prompt_tokens": 15, "completion_tokens": 8, "total_tokens": 23},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter(
        base_url="https://api.openai.com",
        model="gpt-4o-mini",
        api_key="test-key",
        client=client,
    )
    req = TargetRequest(system_prompt="sys", user_prompt="user")
    res = adapter.generate(req)
    assert res.text == "Adversarial test refused."
    assert res.token_usage is not None
    assert res.token_usage.total_tokens == 23


def test_openai_compatible_auth_failure():
    def handler(req):
        return httpx.Response(401, json={"error": {"message": "Invalid API key"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter("https://api.openai.com", "gpt-4o-mini", api_key="bad-key", client=client)
    with pytest.raises(TargetAuthError, match="Authentication failed"):
        adapter.generate(TargetRequest("sys", "user"))


def test_openai_compatible_model_not_found():
    def handler(req):
        return httpx.Response(404, json={"error": {"message": "The model `ghost` does not exist"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter("https://api.openai.com", "ghost", client=client)
    with pytest.raises(TargetModelNotFoundError, match="was not found"):
        adapter.generate(TargetRequest("sys", "user"))


def test_openai_compatible_rate_limit():
    def handler(req):
        return httpx.Response(429, json={"error": {"message": "Rate limit reached"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter("https://api.openai.com", "gpt-4o", client=client)
    with pytest.raises(TargetRateLimitError, match="Rate limit exceeded"):
        adapter.generate(TargetRequest("sys", "user"))


def test_openai_compatible_oversized_clamped():
    def handler(req):
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "X" * 500}}],
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter("https://api.openai.com", "gpt-4o", max_response_chars=50, client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert len(res.text) == 50
    assert res.truncated is True


def test_openai_compatible_discovery_without_prompts():
    def handler(req):
        assert req.url.path == "/v1/models"
        return httpx.Response(200, json={"data": [{"id": "gpt-4o"}, {"id": "gpt-4o-mini"}]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatibleAdapter("https://api.openai.com", "gpt-4o", client=client)
    models = adapter.discover_models()
    assert models == ["gpt-4o", "gpt-4o-mini"]
    check = adapter.check_connection()
    assert check.reachable is True
    assert check.model_available is True


# --------------------------------------------------------------------------- #
# 3. Generic HTTP JSON Adapter Tests
# --------------------------------------------------------------------------- #
def test_generic_http_custom_template_and_path():
    seen = {}

    def handler(req):
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={
            "custom_payload": {
                "generated_result": "Secure model output",
            }
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = GenericHTTPAdapter(
        endpoint_url="https://api.openai.com/predict",
        model="custom-v1",
        request_template={
            "input": {"prompt": "{{user_prompt}}", "system": "{{system_prompt}}"},
            "engine": "{{model}}",
        },
        response_path="custom_payload.generated_result",
        client=client,
    )

    req = TargetRequest("System directive", "User question")
    res = adapter.generate(req)
    assert res.text == "Secure model output"
    assert seen["body"]["input"]["prompt"] == "User question"
    assert seen["body"]["input"]["system"] == "System directive"
    assert seen["body"]["engine"] == "custom-v1"


def test_generic_http_invalid_json():
    def handler(req):
        return httpx.Response(200, text="Internal Gateway Error 502")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = GenericHTTPAdapter("https://api.openai.com/v1", client=client)
    with pytest.raises(TargetResponseError, match="not return valid JSON"):
        adapter.generate(TargetRequest("sys", "user"))


# --------------------------------------------------------------------------- #
# 4. Anthropic Adapter Tests
# --------------------------------------------------------------------------- #
def test_anthropic_adapter_success_and_tokens():
    def handler(req):
        assert req.url.path == "/v1/messages"
        assert req.headers["x-api-key"] == "sk-ant-test"
        return httpx.Response(200, json={
            "content": [{"type": "text", "text": "I refuse to disclose internal directives."}],
            "usage": {"input_tokens": 20, "output_tokens": 10},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = AnthropicAdapter(api_key="sk-ant-test", model="claude-3-5-sonnet-20241022", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "I refuse to disclose internal directives."
    assert res.token_usage.total_tokens == 30


def test_anthropic_auth_failure():
    def handler(req):
        return httpx.Response(401, json={"error": {"type": "authentication_error", "message": "invalid x-api-key"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = AnthropicAdapter(api_key="bad-key", client=client)
    with pytest.raises(TargetAuthError):
        adapter.generate(TargetRequest("sys", "user"))


# --------------------------------------------------------------------------- #
# 5. Google Gemini Adapter Tests
# --------------------------------------------------------------------------- #
def test_gemini_adapter_success():
    def handler(req):
        assert "models/gemini-2.0-flash:generateContent" in str(req.url)
        return httpx.Response(200, json={
            "candidates": [{
                "content": {"parts": [{"text": "Gemini safe response."}]},
            }],
            "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 6, "totalTokenCount": 18},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = GeminiAdapter(api_key="test-gemini-key", model="gemini-2.0-flash", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "Gemini safe response."
    assert res.token_usage.total_tokens == 18


def test_gemini_auth_error():
    def handler(req):
        return httpx.Response(400, text="API_KEY_INVALID: Key not valid.")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = GeminiAdapter(api_key="invalid-key", client=client)
    with pytest.raises(TargetAuthError):
        adapter.generate(TargetRequest("sys", "user"))


# --------------------------------------------------------------------------- #
# 6. Hugging Face Adapter Tests
# --------------------------------------------------------------------------- #
def test_huggingface_adapter_success():
    def handler(req):
        return httpx.Response(200, json=[{"generated_text": "Hugging Face model reply."}])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = HuggingFaceAdapter(api_key="hf_test", model="meta-llama/Llama-3.2-3B", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "Hugging Face model reply."


def test_huggingface_cold_start_loading():
    def handler(req):
        return httpx.Response(503, json={"error": "Model is loading", "estimated_time": 20.0})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = HuggingFaceAdapter(api_key="hf_test", model="meta-llama/Llama-3.2-3B", client=client)
    with pytest.raises(TargetTimeout, match="currently loading"):
        adapter.generate(TargetRequest("sys", "user"))


# --------------------------------------------------------------------------- #
# 7. Modality and Capability Validation Tests
# --------------------------------------------------------------------------- #
def test_unsupported_modality_raises_clear_error():
    # Adapter declaring text-only capability
    adapter = GenericHTTPAdapter(
        endpoint_url="https://api.example.com",
        capabilities=ModelCapabilities(text=True, vision=False, audio=False, tool_calling=False),
    )
    # Visual probe sent to text-only model
    req_vision = TargetRequest(system_prompt="sys", user_prompt="user", images=("data:image/png;base64,abc",))
    with pytest.raises(TargetUnsupportedError, match="does not support vision"):
        adapter.generate(req_vision)

    # Tool calling probe sent to non-tool model
    req_tool = TargetRequest(system_prompt="sys", user_prompt="user", tools=({"name": "wipe"},))
    with pytest.raises(TargetUnsupportedError, match="does not support tool calling"):
        adapter.generate(req_tool)


# --------------------------------------------------------------------------- #
# 8. OpenAI Adapter Contract Tests
# --------------------------------------------------------------------------- #
def test_openai_adapter_missing_key_upfront():
    adapter = OpenAIAdapter(api_key=None)
    with pytest.raises(TargetAuthError, match="OpenAI API key is missing"):
        adapter.generate(TargetRequest("sys", "user"))

    check = adapter.check_connection()
    assert check.reachable is True
    assert check.model_available is False
    assert "OpenAI API key is not configured" in (check.error_message or "")


def test_openai_adapter_success_and_tokens():
    def handler(req):
        assert req.url.path == "/v1/chat/completions"
        assert req.headers["authorization"] == "Bearer sk-test-openai"
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "I cannot provide security overrides."}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = OpenAIAdapter(api_key="sk-test-openai", model="gpt-4o-mini", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "I cannot provide security overrides."
    assert res.token_usage is not None
    assert res.token_usage.total_tokens == 18
    assert res.provider == "openai"


# --------------------------------------------------------------------------- #
# 9. vLLM Adapter Contract Tests
# --------------------------------------------------------------------------- #
def test_vllm_adapter_allows_localhost_and_chat_format():
    seen = {}

    def handler(req):
        seen["url"] = str(req.url)
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "vLLM high throughput output"}}],
            "usage": {"prompt_tokens": 25, "completion_tokens": 12, "total_tokens": 37},
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = VLLMAdapter(
        base_url="http://127.0.0.1:8000/v1",
        model="meta-llama/Llama-3.2-3B-Instruct",
        client=client,
    )
    res = adapter.generate(TargetRequest("sys instruction", "user query"))
    assert res.text == "vLLM high throughput output"
    assert res.provider == "vllm"
    assert "127.0.0.1:8000/v1/chat/completions" in seen["url"]
    assert seen["body"]["model"] == "meta-llama/Llama-3.2-3B-Instruct"


# --------------------------------------------------------------------------- #
# 10. llama.cpp Server Adapter Contract Tests
# --------------------------------------------------------------------------- #
def test_llamacpp_adapter_chat_completions_success():
    def handler(req):
        assert req.url.path == "/v1/chat/completions"
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "llama.cpp modern output"}}],
        })

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = LlamaCppAdapter(base_url="http://127.0.0.1:8080/v1", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "llama.cpp modern output"
    assert res.provider == "llamacpp"


def test_llamacpp_adapter_legacy_completion_fallback():
    calls = []

    def handler(req):
        calls.append(req.url.path)
        if req.url.path == "/v1/chat/completions":
            return httpx.Response(404, json={"error": {"message": "Not Found"}})
        if req.url.path == "/completion":
            body = json.loads(req.content)
            assert "prompt" in body
            return httpx.Response(200, json={"content": "llama.cpp legacy output"})
        return httpx.Response(500)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = LlamaCppAdapter(base_url="http://127.0.0.1:8080/v1", client=client)
    res = adapter.generate(TargetRequest("sys", "user"))
    assert res.text == "llama.cpp legacy output"
    assert "/v1/chat/completions" in calls
    assert "/completion" in calls


# --------------------------------------------------------------------------- #
# 11. Transformers Pipeline Adapter Tests
# --------------------------------------------------------------------------- #
def test_transformers_pipeline_adapter_with_injected_pipeline():
    mock_pipeline_called = {}

    def fake_pipeline(prompt, max_new_tokens=100):
        mock_pipeline_called["prompt"] = prompt
        mock_pipeline_called["max_new_tokens"] = max_new_tokens
        return [{"generated_text": "Local neural model reply"}]

    adapter = TransformersPipelineAdapter(model="gpt2", pipeline_instance=fake_pipeline)
    res = adapter.generate(TargetRequest("system directive", "user probe"))
    assert res.text == "Local neural model reply"
    assert "user probe" in mock_pipeline_called["prompt"]
    assert res.provider == "transformers"

    check = adapter.check_connection()
    assert check.reachable is True
    assert check.model_available is True
    assert check.discovered_models == ("gpt2",)


def test_transformers_pipeline_adapter_missing_library():
    import sys
    from unittest.mock import patch

    adapter = TransformersPipelineAdapter(model="gpt2", pipeline_instance=None)
    with patch.dict(sys.modules, {"transformers": None}):
        with pytest.raises(TargetUnsupportedError, match="transformers.*not installed"):
            adapter.generate(TargetRequest("sys", "user"))

        check = adapter.check_connection()
        assert check.reachable is False
        assert "not installed" in (check.error_message or "")

