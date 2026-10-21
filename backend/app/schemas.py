"""Pydantic models shared by the API, runner, evidence service and database.

Public (API-facing) models never contain unredacted model output or sensitive credentials.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    model_validator,
)

# --------------------------------------------------------------------------- #
# Timestamps: always timezone-aware, normalised to UTC, serialised as
# "YYYY-MM-DDTHH:MM:SS.mmmZ" so JSON output is stable.
# --------------------------------------------------------------------------- #


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc)


def _format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


UtcDatetime = Annotated[
    AwareDatetime,
    AfterValidator(_to_utc),
    PlainSerializer(_format_utc, return_type=str, when_used="always"),
]


class StrictModel(BaseModel):
    """Rejects unknown fields so malformed requests fail loudly."""

    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- #
# Enumerations
# --------------------------------------------------------------------------- #


class TestStatus(str, Enum):
    """Verdict of an AI-behaviour test. ERROR, INCONCLUSIVE and UNSUPPORTED are never a pass."""

    __test__ = False  # not a pytest class

    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"
    INCONCLUSIVE = "INCONCLUSIVE"
    UNSUPPORTED = "UNSUPPORTED"


class TargetMode(str, Enum):
    mock = "mock"
    ollama = "ollama"
    openai_compatible = "openai_compatible"
    generic_http = "generic_http"
    openai = "openai"
    anthropic = "anthropic"
    gemini = "gemini"
    huggingface = "huggingface"
    vllm = "vllm"
    llamacpp = "llamacpp"
    transformers = "transformers"
    custom = "custom"


class MockBehavior(str, Enum):
    vulnerable = "vulnerable"
    defended = "defended"
    ambiguous = "ambiguous"   # neither leaks nor clearly refuses
    flaky = "flaky"           # alternates vulnerable/defended (repeatability demo)
    oversized = "oversized"   # response exceeds the size limit
    error = "error"           # simulated connection failure
    timeout = "timeout"       # simulated inference timeout


class TestCategory(str, Enum):
    __test__ = False

    secret_disclosure = "secret_disclosure"
    instruction_hierarchy = "instruction_hierarchy"
    output_policy = "output_policy"
    consistency = "consistency"
    structured_output = "structured_output"
    tool_authorization = "tool_authorization"
    multimodal_security = "multimodal_security"


class RunState(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"  # unexpected internal failure; result.status is ERROR


class InfraStatus(str, Enum):
    """Status of an infrastructure (isolation) check supplied by Member 2."""

    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"
    PENDING = "PENDING"
    UNAVAILABLE = "UNAVAILABLE"
    MISSING = "MISSING"  # aggregate only: no worker result received


# --------------------------------------------------------------------------- #
# Test metadata and run requests
# --------------------------------------------------------------------------- #

TestId = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")]
RunId = Annotated[str, Field(pattern=r"^run_[0-9a-f]{32}$")]
ConnectionId = Annotated[str, Field(pattern=r"^conn_[0-9a-f]{16,32}$")]


class SecurityTestMeta(StrictModel):
    test_id: str
    name: str
    description: str
    version: str
    category: TestCategory
    expected_behavior: str
    rule_id: str
    rule_version: str
    limitations: list[str]
    supports_repeat_options: bool = False
    required_capabilities: list[str] = Field(default_factory=list)


class SecurityTestListResponse(StrictModel):
    items: list[SecurityTestMeta]


class TargetConfig(StrictModel):
    """Target model configuration for security testing."""

    mode: TargetMode | None = Field(
        None, description="Omit to use the server's configured default mode."
    )
    provider: str | None = None
    connection_id: str | None = None
    mock_behavior: MockBehavior = MockBehavior.defended
    model: str | None = Field(
        None, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$",
        description="Model identifier override.",
    )
    base_url: str | None = None
    api_key: str | None = None
    custom_headers: dict[str, str] | None = None
    request_template: dict[str, Any] | None = None
    response_path: str | None = None
    temperature: float | None = None
    timeout_seconds: float | None = None

    @model_validator(mode="after")
    def _mode_specific_fields(self) -> "TargetConfig":
        if self.mode == TargetMode.ollama and "mock_behavior" in self.model_fields_set:
            raise ValueError("mock_behavior is only valid with mode 'mock'")
        if self.mode == TargetMode.mock and self.model is not None:
            raise ValueError("model is only valid with mode 'ollama'")
        return self


class RunOptions(StrictModel):
    repeat_count: int = Field(3, ge=2, le=10, description="Executions for the repeatability test.")
    repeat_base_test: TestId = Field(
        "canary-disclosure", description="Registered test to repeat (repeatability test only)."
    )


class RunRequest(StrictModel):
    test_id: TestId
    target: TargetConfig = Field(default_factory=TargetConfig)
    options: RunOptions = Field(default_factory=RunOptions)


# --------------------------------------------------------------------------- #
# Evidence and evaluation results (public)
# --------------------------------------------------------------------------- #


class EvidenceRef(StrictModel):
    evidence_id: str  # unique within the run, e.g. "ev-02"
    kind: Literal["test_definition", "model_output", "target_error", "rule_result"]


class EvidenceItem(StrictModel):
    evidence_id: str
    run_id: str
    test_id: str
    kind: Literal["test_definition", "model_output", "target_error", "rule_result"]
    content: str
    redacted: bool = False
    truncated: bool = False
    size_chars: int
    execution_index: int | None = None
    observed_status: TestStatus | None = None
    rule_id: str | None = None
    rule_version: str | None = None
    recorded_at: UtcDatetime


class RepeatExecutionSummary(StrictModel):
    index: int
    status: TestStatus


class RepeatabilitySummary(StrictModel):
    base_test_id: str
    executions: int
    outcomes: list[RepeatExecutionSummary]
    agree: bool
    agreement_rate: float = Field(ge=0.0, le=1.0)
    note: str = (
        "Agreement across executions is an observation, not proof that inference is deterministic."
    )


class TokenUsageSummary(StrictModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class EvaluationResult(StrictModel):
    test_id: str
    test_version: str
    rule_id: str
    rule_version: str
    status: TestStatus
    explanation: str
    evidence_refs: list[EvidenceRef]
    started_at: UtcDatetime
    completed_at: UtcDatetime
    matched_indicators: list[str]
    limitations: list[str]
    repeatability: RepeatabilitySummary | None = None
    token_usage: TokenUsageSummary | None = None
    observed_latency_ms: int | None = None


# --------------------------------------------------------------------------- #
# Infrastructure results supplied by Member 2's worker
# --------------------------------------------------------------------------- #

_Short = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$")]


class InfraCheckSubmission(StrictModel):
    """Posted by the sandbox worker. SafeBox never invents these values."""

    worker_id: _Short
    run_id: RunId
    check_id: _Short
    policy_id: _Short
    policy_version: _Short
    reported_state: Literal["COMPLETED", "PENDING", "UNAVAILABLE"] = "COMPLETED"
    observed: str | None = Field(None, max_length=500)
    expected: str | None = Field(None, max_length=500)
    evidence_ref: str | None = Field(None, max_length=256)
    timestamp: UtcDatetime
    error: str | None = Field(None, max_length=500)
    limitation: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def _completed_needs_outcomes(self) -> "InfraCheckSubmission":
        if self.reported_state == "COMPLETED" and not self.error:
            if self.observed is None or self.expected is None:
                raise ValueError("COMPLETED checks require both 'observed' and 'expected'")
        if self.reported_state == "UNAVAILABLE" and not (self.error or self.limitation):
            raise ValueError("UNAVAILABLE checks must explain why via 'error' or 'limitation'")
        return self


class InfraCheckResult(InfraCheckSubmission):
    status: InfraStatus
    received_at: UtcDatetime
    result_type: Literal["infrastructure_isolation"] = "infrastructure_isolation"


class InfrastructureSummary(StrictModel):
    result_type: Literal["infrastructure_isolation"] = "infrastructure_isolation"
    status: InfraStatus
    checks: list[InfraCheckResult] = Field(default_factory=list)
    note: str = (
        "Reported by the sandbox worker (Member 2). The AI behaviour evaluator never "
        "contributes to, or substitutes for, this status. Covers submitted checks only."
    )


# --------------------------------------------------------------------------- #
# Run records and history (public)
# --------------------------------------------------------------------------- #


class TargetInfo(StrictModel):
    mode: TargetMode | str
    adapter: str
    model: str
    provider: str | None = None
    mock_behavior: MockBehavior | None = None
    connection_id: str | None = None
    is_remote: bool = False
    capabilities: dict[str, bool] | None = None


class RunRecord(StrictModel):
    result_type: Literal["ai_behavior_test"] = "ai_behavior_test"
    run_id: str
    state: RunState
    test_id: str
    test_version: str
    target: TargetInfo
    created_at: UtcDatetime
    completed_at: UtcDatetime | None = None
    result: EvaluationResult | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)
    infrastructure: InfrastructureSummary


class RunSummary(StrictModel):
    run_id: str
    state: RunState
    test_id: str
    test_version: str
    status: TestStatus | None = None
    target_mode: TargetMode | str
    provider: str | None = None
    model: str | None = None
    created_at: UtcDatetime
    completed_at: UtcDatetime | None = None


class RunListResponse(StrictModel):
    items: list[RunSummary]
    total: int
    limit: int
    offset: int
    has_more: bool


class OllamaStatus(StrictModel):
    reachable: bool
    configured_model: str
    model_available: bool | None = None


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    app_name: str
    environment: str
    version: str
    target_mode: TargetMode | str
    database_ok: bool
    ollama: OllamaStatus | None = None
    supported_providers: list[str] = Field(default_factory=list)
    time: UtcDatetime


class ErrorBody(StrictModel):
    code: str
    message: str
    details: list[dict] | None = None


class ErrorResponse(StrictModel):
    error: ErrorBody


# --------------------------------------------------------------------------- #
# Connections and Model Discovery schemas
# --------------------------------------------------------------------------- #


class ModelCapabilitiesSchema(StrictModel):
    text: bool = True
    vision: bool = False
    audio: bool = False
    structured_output: bool = False
    tool_calling: bool = False


class SavedConnectionCreate(StrictModel):
    name: str = Field(min_length=1, max_length=64)
    provider: str = Field(min_length=1, max_length=32)
    model: str = Field(min_length=1, max_length=128)
    base_url: str | None = None
    api_key: str | None = None
    custom_headers: dict[str, str] | None = None
    request_template: dict[str, Any] | None = None
    response_path: str | None = None


class SavedConnectionUpdate(StrictModel):
    name: str | None = Field(None, min_length=1, max_length=64)
    model: str | None = Field(None, min_length=1, max_length=128)
    base_url: str | None = None
    api_key: str | None = None
    custom_headers: dict[str, str] | None = None
    request_template: dict[str, Any] | None = None
    response_path: str | None = None


class SavedConnectionResponse(StrictModel):
    connection_id: str
    name: str
    provider: str
    model: str
    base_url: str | None = None
    has_api_key: bool = False
    masked_api_key: str | None = None
    custom_headers: dict[str, str] | None = None
    request_template: dict[str, Any] | None = None
    response_path: str | None = None
    capabilities: ModelCapabilitiesSchema | None = None
    is_remote: bool = False
    created_at: UtcDatetime
    updated_at: UtcDatetime


class SavedConnectionListResponse(StrictModel):
    items: list[SavedConnectionResponse]


class ConnectionTestRequest(StrictModel):
    provider: str
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    connection_id: str | None = None


class ConnectionTestResponse(StrictModel):
    reachable: bool
    model_available: bool | None = None
    latency_ms: int | None = None
    capabilities: ModelCapabilitiesSchema | None = None
    discovered_models: list[str] = Field(default_factory=list)
    error_message: str | None = None


class ProviderMetaResponse(StrictModel):
    id: str
    name: str
    tier: str
    description: str
    requires_api_key: bool
    requires_base_url: bool
    default_base_url: str | None = None
    default_model: str | None = None
    is_remote: bool
    capabilities: ModelCapabilitiesSchema


# --------------------------------------------------------------------------- #
# Internal raw models (persisted; never returned directly by the API)
# --------------------------------------------------------------------------- #


class RawExecution(BaseModel):
    index: int
    test_id: str
    test_version: str
    started_at: UtcDatetime
    completed_at: UtcDatetime
    input_digest: str
    output_text: str | None = None
    output_truncated: bool = False
    error_kind: str | None = None
    error_message: str | None = None
    latency_ms: int | None = None
    status: TestStatus
    rule_id: str
    rule_version: str
    explanation: str
    matched_indicators: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    token_usage: dict[str, int | None] | None = None
    provider: str | None = None


class RawRunData(BaseModel):
    run_id: str
    state: RunState
    test_id: str
    test_name: str
    test_version: str
    expected_behavior: str
    target: TargetInfo
    created_at: UtcDatetime
    completed_at: UtcDatetime | None = None
    executions: list[RawExecution] = Field(default_factory=list)
    status: TestStatus | None = None
    rule_id: str | None = None
    rule_version: str | None = None
    explanation: str | None = None
    matched_indicators: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    repeatability: RepeatabilitySummary | None = None
