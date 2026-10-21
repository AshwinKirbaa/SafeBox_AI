"""Universal target-model adapter interface and contract.

Defines the shared interface, capability declarations, normalized requests/responses,
connection check contracts, and standard error taxonomy for all SafeBox AI model adapters.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

logger = logging.getLogger("safebox.adapter")


@dataclass(frozen=True)
class ModelCapabilities:
    """Declared modality and execution features supported by a target model."""

    text: bool = True
    vision: bool = False
    audio: bool = False
    structured_output: bool = False
    tool_calling: bool = False

    def to_dict(self) -> dict[str, bool]:
        return {
            "text": self.text,
            "vision": self.vision,
            "audio": self.audio,
            "structured_output": self.structured_output,
            "tool_calling": self.tool_calling,
        }


@dataclass(frozen=True)
class TokenUsage:
    """Observed token usage reported by the inference provider."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None

    def to_dict(self) -> dict[str, int | None]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(frozen=True)
class ConnectionCheckResult:
    """Outcome of probing provider reachability and model availability without running tests."""

    reachable: bool
    model_available: bool | None = None
    latency_ms: int | None = None
    discovered_models: tuple[str, ...] = ()
    capabilities: ModelCapabilities | None = None
    error_message: str | None = None


@dataclass(frozen=True)
class TargetRequest:
    """Normalized test request payload sent to any model adapter."""

    system_prompt: str
    user_prompt: str
    images: tuple[str, ...] = ()
    audio: tuple[str, ...] = ()
    tools: tuple[dict, ...] = ()
    schema_constraint: dict | None = None
    temperature: float = 0.0
    extra_params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class TargetResponse:
    """Normalized output returned by any model adapter."""

    text: str
    truncated: bool  # output was cut at the configured size limit
    adapter: str
    model: str
    latency_ms: int
    token_usage: TokenUsage | None = None
    provider: str | None = None
    tool_calls: tuple[dict, ...] = ()
    raw_details: dict | None = None


class TargetError(Exception):
    """Base execution failure. The runner maps TargetError to status ERROR or UNSUPPORTED."""

    kind = "error"

    def __init__(self, public_message: str) -> None:
        super().__init__(public_message)
        self.public_message = public_message  # safe to store / show; no prompts or secrets


class TargetTimeout(TargetError):
    kind = "timeout"


class TargetConnectionError(TargetError):
    kind = "connection"


class TargetAuthError(TargetError):
    kind = "authentication"


class TargetModelNotFoundError(TargetError):
    kind = "model_not_found"


class TargetRateLimitError(TargetError):
    kind = "rate_limit"


class TargetUnsupportedError(TargetError):
    kind = "unsupported"


class TargetHTTPError(TargetError):
    kind = "http_error"


class TargetResponseError(TargetError):
    kind = "invalid_response"


def clamp_output(text: str, max_chars: int) -> tuple[str, bool]:
    """Enforce the response-size limit; returns (text, truncated)."""
    if len(text) > max_chars:
        return text[:max_chars], True
    return text, False


class ModelAdapter(ABC):
    """Abstract base class for all SafeBox AI model connectors."""

    name: str = "adapter"
    provider: str = "generic"
    model: str = "default"
    capabilities: ModelCapabilities = ModelCapabilities()
    is_remote: bool = False
    timeout_seconds: float = 30.0

    @abstractmethod
    def generate(self, request: TargetRequest) -> TargetResponse:
        """Send one test input; raise TargetError subclasses on any failure."""

    def check_connection(self, timeout_seconds: float = 5.0) -> ConnectionCheckResult:
        """Check provider reachability and model availability without running adversarial prompts."""
        return ConnectionCheckResult(
            reachable=True,
            model_available=True,
            latency_ms=0,
            capabilities=self.capabilities,
            discovered_models=(self.model,) if self.model else (),
        )

    def discover_models(self, timeout_seconds: float = 5.0) -> list[str]:
        """Discover installed or available models for this provider."""
        return [self.model] if self.model else []

    def validate_capabilities(self, request: TargetRequest) -> None:
        """Reject tests demanding modalities or features unsupported by this adapter."""
        if request.images and not self.capabilities.vision:
            raise TargetUnsupportedError(
                f"Model '{self.model}' does not support vision/image input."
            )
        if request.audio and not self.capabilities.audio:
            raise TargetUnsupportedError(
                f"Model '{self.model}' does not support audio input."
            )
        if request.tools and not self.capabilities.tool_calling:
            raise TargetUnsupportedError(
                f"Model '{self.model}' does not support tool calling."
            )
        if request.schema_constraint and not self.capabilities.structured_output:
            raise TargetUnsupportedError(
                f"Model '{self.model}' does not support structured JSON schema constraints."
            )
