"""Central Adapter Registry and Factory for all SafeBox AI model integrations.

Allows dynamic instantiation, capability inspection, and provider dispatch
for all supported local and remote inference targets.
"""
from __future__ import annotations

import logging
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

from app.config import Settings, is_loopback_host
from app.schemas import MockBehavior, TargetConfig, TargetMode
from app.services.generic_http_adapter import GenericHTTPAdapter
from app.services.mock_adapter import MockAdapter
from app.services.model_adapter import ModelAdapter, ModelCapabilities
from app.services.ollama_adapter import OllamaAdapter
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

logger = logging.getLogger("safebox.registry.adapter")


SUPPORTED_PROVIDERS_META = [
    {
        "id": "mock",
        "name": "Deterministic Mock Simulator",
        "tier": "A",
        "description": "Zero-dependency deterministic security simulation for development and testing.",
        "requires_api_key": False,
        "requires_base_url": False,
        "default_model": "mock-defended",
        "is_remote": False,
        "capabilities": {"text": True, "vision": True, "audio": True, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "ollama",
        "name": "Ollama Local Neural Engine",
        "tier": "A",
        "description": "Local offline neural inference via Ollama service (POST /api/generate).",
        "requires_api_key": False,
        "requires_base_url": False,
        "default_base_url": "http://127.0.0.1:11434",
        "default_model": "llama3.2:3b",
        "is_remote": False,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "openai_compatible",
        "name": "OpenAI-Compatible Inference API",
        "tier": "A",
        "description": "Universal connector for any server adhering to the OpenAI /v1/chat/completions specification.",
        "requires_api_key": False,
        "requires_base_url": True,
        "default_base_url": "",
        "default_model": "default",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "xai",
        "name": "xAI Grok API",
        "tier": "A",
        "description": "xAI Grok models through the OpenAI-compatible inference API.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://api.x.ai/v1",
        "default_model": "default",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "groq",
        "name": "GroqCloud API",
        "tier": "A",
        "description": "Groq-hosted models through its OpenAI-compatible API.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://api.groq.com/openai/v1",
        "default_model": "default",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": True, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "openrouter",
        "name": "OpenRouter API",
        "tier": "A",
        "description": "Multi-provider model routing through the OpenAI-compatible OpenRouter API.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://openrouter.ai/api/v1",
        "default_model": "default",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "generic_http",
        "name": "Generic HTTP JSON Endpoint",
        "tier": "A",
        "description": "Customizable HTTP JSON inference connector with arbitrary payload templates and response mappings.",
        "requires_api_key": False,
        "requires_base_url": True,
        "default_base_url": "",
        "default_model": "custom-model",
        "is_remote": True,
        "capabilities": {"text": True, "vision": False, "audio": False, "structured_output": False, "tool_calling": False},
    },
    {
        "id": "openai",
        "name": "OpenAI API",
        "tier": "B",
        "description": "Native OpenAI platform integration supporting GPT-4o, GPT-4o-mini, o1, and o3 series.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude API",
        "tier": "B",
        "description": "Native Anthropic Messages API integration for Claude 3.5 Sonnet, Haiku, and Claude 3.7.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://api.anthropic.com",
        "default_model": "claude-3-5-sonnet-20241022",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "gemini",
        "name": "Google Gemini API",
        "tier": "B",
        "description": "Native Google Generative AI REST integration for Gemini models (e.g. gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro).",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://generativelanguage.googleapis.com",
        "default_model": "gemini-2.0-flash",
        "is_remote": True,
        "capabilities": {"text": True, "vision": True, "audio": True, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "huggingface",
        "name": "Hugging Face Inference Endpoints",
        "tier": "B",
        "description": "Hosted serverless inference API on the Hugging Face Hub.",
        "requires_api_key": True,
        "requires_base_url": False,
        "default_base_url": "https://api-inference.huggingface.co/models",
        "default_model": "meta-llama/Llama-3.2-3B-Instruct",
        "is_remote": True,
        "capabilities": {"text": True, "vision": False, "audio": False, "structured_output": False, "tool_calling": False},
    },
    {
        "id": "vllm",
        "name": "vLLM High-Throughput Engine",
        "tier": "B",
        "description": "High-throughput self-hosted inference server with OpenAI-compatible endpoint.",
        "requires_api_key": False,
        "requires_base_url": True,
        "default_base_url": "http://127.0.0.1:8000/v1",
        "default_model": "meta-llama/Llama-3.2-3B-Instruct",
        "is_remote": False,
        "capabilities": {"text": True, "vision": True, "audio": False, "structured_output": True, "tool_calling": True},
    },
    {
        "id": "llamacpp",
        "name": "llama.cpp Server",
        "tier": "C",
        "description": "Local lightweight GGUF inference server via llama-server executable.",
        "requires_api_key": False,
        "requires_base_url": True,
        "default_base_url": "http://127.0.0.1:8080/v1",
        "default_model": "default",
        "is_remote": False,
        "capabilities": {"text": True, "vision": False, "audio": False, "structured_output": True, "tool_calling": False},
    },
    {
        "id": "transformers",
        "name": "Local Transformers Pipeline",
        "tier": "C",
        "description": "In-process Hugging Face Transformers pipeline running directly in the Python runtime.",
        "requires_api_key": False,
        "requires_base_url": False,
        "default_model": "gpt2",
        "is_remote": False,
        "capabilities": {"text": True, "vision": False, "audio": False, "structured_output": False, "tool_calling": False},
    },
]

PROVIDER_ENV_KEYS: dict[str, list[str]] = {
    "gemini": ["GEMINI_API_KEY", "GOOGLE_API_KEY", "SAFEBOX_GEMINI_API_KEY"],
    "openai": ["OPENAI_API_KEY", "SAFEBOX_OPENAI_API_KEY"],
    "anthropic": ["ANTHROPIC_API_KEY", "SAFEBOX_ANTHROPIC_API_KEY"],
    "huggingface": ["HF_TOKEN", "HUGGINGFACE_API_KEY", "SAFEBOX_HF_TOKEN"],
    "xai": ["XAI_API_KEY", "SAFEBOX_XAI_API_KEY"],
    "groq": ["GROQ_API_KEY", "SAFEBOX_GROQ_API_KEY"],
    "openrouter": ["OPENROUTER_API_KEY", "SAFEBOX_OPENROUTER_API_KEY"],
}


def resolve_api_key(provider: str, explicit_key: str | None = None) -> str | None:
    """Resolve provider API key from explicit argument, environment variables, or local env files."""
    import os
    from pathlib import Path
    import dotenv

    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    target_vars = PROVIDER_ENV_KEYS.get(provider.lower(), [])
    for env_var in target_vars:
        val = os.environ.get(env_var)
        if val and val.strip():
            return val.strip()

    # Search local .env files directly for provider keys without altering os.environ
    for env_path in (Path(".env"), Path("backend/.env"), Path(__file__).resolve().parent.parent.parent / ".env"):
        if env_path.exists():
            try:
                vals = dotenv.dotenv_values(env_path)
                for env_var in target_vars:
                    v = vals.get(env_var)
                    if v and str(v).strip():
                        return str(v).strip()
            except Exception:
                pass
    return None


class AdapterRegistry:
    """Registry and factory resolving model adapters from configurations."""

    @classmethod
    def list_providers(cls) -> list[dict[str, Any]]:
        return SUPPORTED_PROVIDERS_META

    @classmethod
    def create_adapter(
        cls,
        settings: Settings,
        target: TargetConfig,
        connection_data: dict[str, Any] | None = None,
        client: httpx.Client | None = None,
    ) -> ModelAdapter:
        # If connection_data is provided (from saved connection), merge with target
        provider = (target.provider or (target.mode.value if isinstance(target.mode, TargetMode) else target.mode) or settings.target_mode.value).lower()
        if connection_data:
            provider = connection_data.get("provider", provider).lower()

        model = target.model or (connection_data.get("model") if connection_data else None)
        base_url = target.base_url or (connection_data.get("base_url") if connection_data else None)
        raw_key = target.api_key or (connection_data.get("api_key") if connection_data else None)
        api_key = resolve_api_key(provider, raw_key)
        remote_providers = {"openai", "anthropic", "gemini", "huggingface", "xai", "groq", "openrouter"}
        is_remote_openai_compatible = provider == "openai_compatible" and not (
            base_url and is_loopback_host(urlparse(base_url).hostname or "")
        )
        default_timeout = (
            settings.remote_inference_timeout_seconds
            if provider in remote_providers or is_remote_openai_compatible
            else settings.inference_timeout_seconds
        )
        timeout = target.timeout_seconds or default_timeout
        max_chars = settings.max_response_chars

        fallback_model = target.fallback_model or (connection_data.get("fallback_model") if connection_data else None)

        if provider == "mock":
            behavior = target.mock_behavior or MockBehavior.defended
            return MockAdapter(behavior=behavior, max_response_chars=max_chars)

        if provider == "ollama":
            url = base_url or settings.ollama_base_url
            mod = model or settings.ollama_model
            return OllamaAdapter(url, mod, timeout, max_chars, client)

        if provider == "openai_compatible":
            url = base_url or "https://api.openai.com/v1"
            mod = model or "default"
            return OpenAICompatibleAdapter(
                base_url=url,
                model=mod,
                api_key=api_key,
                extra_headers=target.custom_headers,
                timeout_seconds=timeout,
                max_response_chars=max_chars,
                allow_localhost=True,
                allow_private=True,
                client=client,
            )

        if provider in {"xai", "groq", "openrouter"}:
            provider_defaults = {
                "xai": "https://api.x.ai/v1",
                "groq": "https://api.groq.com/openai/v1",
                "openrouter": "https://openrouter.ai/api/v1",
            }
            adapter = OpenAICompatibleAdapter(
                base_url=base_url or provider_defaults[provider],
                model=model or "default",
                api_key=api_key,
                extra_headers=target.custom_headers,
                timeout_seconds=timeout,
                max_response_chars=max_chars,
                allow_localhost=False,
                allow_private=False,
                client=client,
            )
            adapter.provider = provider
            return adapter

        if provider == "generic_http":
            url = base_url or (connection_data.get("base_url") if connection_data else "")
            mod = model or "generic-model"
            req_template = target.request_template or (connection_data.get("request_template") if connection_data else None)
            resp_path = target.response_path or (connection_data.get("response_path") if connection_data else None)
            return GenericHTTPAdapter(
                endpoint_url=url,
                model=mod,
                headers=target.custom_headers or {},
                request_template=req_template,
                response_path=resp_path,
                timeout_seconds=timeout,
                max_response_chars=max_chars,
                allow_localhost=True,
                allow_private=True,
                client=client,
            )

        if provider == "openai":
            mod = model or "gpt-4o-mini"
            url = base_url or "https://api.openai.com/v1"
            return OpenAIAdapter(api_key=api_key, model=mod, base_url=url, timeout_seconds=timeout, max_response_chars=max_chars, client=client)

        if provider == "anthropic":
            mod = model or "claude-3-5-sonnet-20241022"
            url = base_url or "https://api.anthropic.com"
            return AnthropicAdapter(api_key=api_key, model=mod, base_url=url, timeout_seconds=timeout, max_response_chars=max_chars, client=client)

        if provider == "gemini":
            mod = model or "gemini-2.0-flash"
            url = base_url or "https://generativelanguage.googleapis.com"
            return GeminiAdapter(
                api_key=api_key,
                model=mod,
                base_url=url,
                timeout_seconds=timeout,
                max_response_chars=max_chars,
                fallback_model=fallback_model,
                client=client,
            )

        if provider == "huggingface":
            mod = model or "meta-llama/Llama-3.2-3B-Instruct"
            url = base_url or "https://api-inference.huggingface.co/models"
            return HuggingFaceAdapter(api_key=api_key, model=mod, base_url=url, timeout_seconds=timeout, max_response_chars=max_chars, client=client)

        if provider == "vllm":
            url = base_url or "http://127.0.0.1:8000/v1"
            mod = model or "meta-llama/Llama-3.2-3B-Instruct"
            return VLLMAdapter(base_url=url, model=mod, api_key=api_key, timeout_seconds=timeout, max_response_chars=max_chars, client=client)

        if provider == "llamacpp":
            url = base_url or "http://127.0.0.1:8080/v1"
            mod = model or "default"
            return LlamaCppAdapter(base_url=url, model=mod, api_key=api_key, timeout_seconds=timeout, max_response_chars=max_chars, client=client)

        if provider == "transformers":
            mod = model or "gpt2"
            return TransformersPipelineAdapter(model=mod, max_response_chars=max_chars)

        # Never silently fall back to mock
        supported_str = ", ".join(p["id"] for p in SUPPORTED_PROVIDERS_META)
        raise ValueError(f"Unrecognized or unsupported provider '{provider}'. Supported providers are: {supported_str}.")
