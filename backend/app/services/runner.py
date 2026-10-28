"""Executes registered tests against a target adapter and persists the outcome."""
from __future__ import annotations

import hashlib
import logging
import threading
import time
import uuid
from typing import Callable

import httpx

from app.config import Settings
from app.database import Database
from app.schemas import (
    RawExecution,
    RawRunData,
    RepeatabilitySummary,
    RepeatExecutionSummary,
    RunRecord,
    RunRequest,
    RunState,
    TargetConfig,
    TargetInfo,
    TargetMode,
    TestStatus,
    utc_now,
)
from app.services import evaluator
from app.services.adapter_registry import AdapterRegistry
from app.services.evidence import EvidenceService
from app.services.mock_adapter import MockAdapter
from app.services.model_adapter import (
    ModelAdapter,
    TargetError,
    TargetRequest,
    TargetUnsupportedError,
)
from app.services.ollama_adapter import OllamaAdapter
from app.services.test_registry import SecurityCase, TestRegistry
from app.services.activity_logger import log_security_test_run, log_test_dispatched

logger = logging.getLogger("safebox.runner")

AdapterFactory = Callable[[Settings, TargetConfig], ModelAdapter]


class RunnerError(Exception):
    """Base class; carries an HTTP-friendly code."""

    code = "runner_error"
    http_status = 400


class UnknownTestError(RunnerError):
    code, http_status = "unknown_test", 404


class TargetModeNotPermitted(RunnerError):
    code, http_status = "target_mode_not_permitted", 400


class InvalidRunOptions(RunnerError):
    code, http_status = "invalid_options", 422


class ConnectionNotFoundError(RunnerError):
    code, http_status = "connection_not_found", 404


class RunnerBusy(RunnerError):
    code, http_status = "runner_busy", 429


def default_adapter_factory(settings: Settings, target: TargetConfig,
                            client: httpx.Client | None = None) -> ModelAdapter:
    mode = target.mode or settings.target_mode
    if mode == TargetMode.mock and not target.provider:
        return MockAdapter(target.mock_behavior, settings.max_response_chars)
    if mode == TargetMode.ollama and not target.provider:
        return OllamaAdapter(settings.ollama_base_url, target.model or settings.ollama_model,
                             settings.inference_timeout_seconds, settings.max_response_chars, client)
    return AdapterRegistry.create_adapter(settings, target, client=client)


class SecurityTestRunner:
    def __init__(self, settings: Settings, registry: TestRegistry, db: Database,
                 evidence: EvidenceService, adapter_factory: AdapterFactory | None = None) -> None:
        self.settings = settings
        self.registry = registry
        self.db = db
        self.evidence = evidence
        self.adapter_factory = adapter_factory or default_adapter_factory
        # Runs execute synchronously in the request thread; this bounds parallel runs.
        self._slots = threading.BoundedSemaphore(settings.max_concurrent_runs)

    # ------------------------------------------------------------------ public ---
    def run(self, request: RunRequest) -> RunRecord:
        case = self.registry.get(request.test_id)
        if case is None:
            raise UnknownTestError(f"Unknown test id {request.test_id!r}.")

        # If a saved connection is referenced, load its stored configuration
        conn_data = None
        if request.target.connection_id:
            conn_data = self.db.get_connection(request.target.connection_id)
            if not conn_data:
                raise ConnectionNotFoundError(f"Saved connection '{request.target.connection_id}' was not found.")
            target_dict = request.target.model_dump()
            if not target_dict.get("provider") and conn_data.get("provider"):
                target_dict["provider"] = conn_data["provider"]
            if not target_dict.get("model") and conn_data.get("model"):
                target_dict["model"] = conn_data["model"]
            if not target_dict.get("base_url") and conn_data.get("base_url"):
                target_dict["base_url"] = conn_data["base_url"]
            if not target_dict.get("api_key") and conn_data.get("api_key"):
                target_dict["api_key"] = conn_data["api_key"]
            if not target_dict.get("custom_headers") and conn_data.get("custom_headers"):
                target_dict["custom_headers"] = conn_data["custom_headers"]
            if not target_dict.get("request_template") and conn_data.get("request_template"):
                target_dict["request_template"] = conn_data["request_template"]
            if not target_dict.get("response_path") and conn_data.get("response_path"):
                target_dict["response_path"] = conn_data["response_path"]
            if not target_dict.get("fallback_model") and conn_data.get("fallback_model"):
                target_dict["fallback_model"] = conn_data["fallback_model"]
            if conn_data.get("model_type") and "model_type" not in request.target.model_fields_set:
                target_dict["model_type"] = conn_data["model_type"]

            conn_provider = target_dict.get("provider")
            if conn_provider and conn_provider != "mock":
                if target_dict.get("mode") in (None, TargetMode.mock, "mock", TargetMode.connection, "connection"):
                    if conn_provider in TargetMode.__members__:
                        target_dict["mode"] = TargetMode(conn_provider)
                    else:
                        target_dict["mode"] = conn_provider
                target_dict["mock_behavior"] = None

            request = RunRequest(
                test_id=request.test_id,
                target=TargetConfig(**target_dict),
                options=request.options,
            )

        if request.target.model_type.value not in ("chat", "vision"):
            raise InvalidRunOptions(
                f"Security benchmark '{request.test_id}' requires a chat or vision model; "
                f"connection type '{request.target.model_type.value}' must use its type-specific contract probe."
            )

        effective_provider = request.target.provider or (conn_data.get("provider") if conn_data else None)
        mode = request.target.mode
        if (mode is None or mode in (TargetMode.mock, TargetMode.connection)) and effective_provider and effective_provider != "mock":
            if effective_provider in TargetMode.__members__:
                mode = TargetMode(effective_provider)
            else:
                mode = effective_provider
        elif mode is None:
            mode = self.settings.target_mode

        if mode == TargetMode.ollama and not (
            self.settings.target_mode == TargetMode.ollama or self.settings.allow_ollama_target
        ):
            raise TargetModeNotPermitted(
                "Ollama mode is not enabled on this server (set SAFEBOX_TARGET_MODE=ollama or SAFEBOX_ALLOW_OLLAMA_TARGET=true).")
        base_case = self._resolve_base(case, request)

        if not self._slots.acquire(blocking=False):
            raise RunnerBusy("Too many concurrent runs; retry shortly.")
        try:
            return self._execute(case, base_case, request, mode)
        finally:
            self._slots.release()

    # ----------------------------------------------------------------- internals ---
    def _resolve_base(self, case: SecurityCase, request: RunRequest) -> SecurityCase | None:
        if not case.is_repeat_wrapper:
            return None
        base = self.registry.get(request.options.repeat_base_test)
        if base is None or base.is_repeat_wrapper:
            raise InvalidRunOptions(
                f"repeat_base_test must be one of {self.registry.base_test_ids()}.")
        return base

    def _execute(self, case: SecurityCase, base: SecurityCase | None,
                 request: RunRequest, mode: TargetMode | str) -> RunRecord:
        run_id = f"run_{uuid.uuid4().hex}"
        adapter = self.adapter_factory(self.settings, request.target)
        provider_name = getattr(adapter, "provider", adapter.name)
        is_remote = getattr(adapter, "is_remote", False)
        capabilities_dict = adapter.capabilities.to_dict() if hasattr(adapter, "capabilities") else None

        effective_mode = mode
        if (effective_mode == TargetMode.mock or effective_mode == "mock") and provider_name != "mock":
            if provider_name in TargetMode.__members__:
                effective_mode = TargetMode(provider_name)
            else:
                effective_mode = provider_name

        raw = RawRunData(
            run_id=run_id, state=RunState.RUNNING, test_id=case.test_id, test_name=case.name,
            test_version=case.version, expected_behavior=case.expected_behavior,
            target=TargetInfo(
                mode=effective_mode, adapter=adapter.name, model=adapter.model,
                provider=provider_name,
                is_remote=is_remote,
                capabilities=capabilities_dict,
                connection_id=request.target.connection_id,
                mock_behavior=request.target.mock_behavior if (effective_mode == TargetMode.mock and provider_name == "mock") else None),
            created_at=utc_now(),
        )
        self.db.create_run(raw)
        logger.info("run started run_id=%s test=%s mode=%s provider=%s", run_id, case.test_id,
                    effective_mode.value if hasattr(effective_mode, "value") else effective_mode, provider_name)
        try:
            self._evaluate(raw, case, base, adapter, request.options.repeat_count, request)
            raw.state = RunState.COMPLETED
        except Exception:  # noqa: BLE001 - never leave a run RUNNING or report a pass
            logger.exception("run aborted run_id=%s", run_id)
            raw.state = RunState.ABORTED
            raw.status = TestStatus.ERROR
            raw.rule_id, raw.rule_version = case.rule_id, case.rule_version
            raw.explanation = "Run aborted by an unexpected internal error; no verdict was reached."
            raw.matched_indicators = ["internal_error"]
        raw.completed_at = utc_now()
        self.db.save_run(raw)
        logger.info("run finished run_id=%s status=%s", run_id, raw.status.value if raw.status else None)
        return self.evidence.export_run(raw, self.db.infra_summary(run_id))

    def _evaluate(self, raw: RawRunData, case: SecurityCase, base: SecurityCase | None,
                  adapter: ModelAdapter, repeat_count: int, request: RunRequest) -> None:
        deadline = time.monotonic() + self.settings.max_run_seconds
        if base is None:
            ex = self._single_execution(0, case, adapter, request, raw.run_id)
            raw.executions.append(ex)
            self._copy_verdict(raw, ex)
            return

        for i in range(repeat_count):
            if time.monotonic() > deadline:
                raw.executions.append(self._error_execution(
                    i, base, "timeout", "Run deadline exceeded before this execution."))
                break
            raw.executions.append(self._single_execution(i, base, adapter, request, raw.run_id))
        statuses = [e.status for e in raw.executions]
        verdict, agree, rate = evaluator.aggregate_repeats(case, statuses)
        raw.status, raw.rule_id, raw.rule_version = verdict.status, verdict.rule_id, verdict.rule_version
        raw.explanation = verdict.explanation
        raw.matched_indicators = list(verdict.matched_indicators)
        raw.limitations = list(verdict.limitations)
        raw.repeatability = RepeatabilitySummary(
            base_test_id=base.test_id, executions=len(statuses), agree=agree, agreement_rate=rate,
            outcomes=[RepeatExecutionSummary(index=e.index, status=e.status) for e in raw.executions])

    @staticmethod
    def _copy_verdict(raw: RawRunData, ex: RawExecution) -> None:
        raw.status, raw.rule_id, raw.rule_version = ex.status, ex.rule_id, ex.rule_version
        raw.explanation = ex.explanation
        raw.matched_indicators = list(ex.matched_indicators)
        raw.limitations = list(ex.limitations)

    def _error_execution(self, index: int, case: SecurityCase, kind: str, message: str,
                         digest: str = "", started=None) -> RawExecution:
        verdict = evaluator.error_verdict(case, kind, message)
        now = utc_now()
        return RawExecution(
            index=index, test_id=case.test_id, test_version=case.version,
            started_at=started or now, completed_at=now, input_digest=digest,
            error_kind=kind, error_message=message, status=verdict.status,
            rule_id=verdict.rule_id, rule_version=verdict.rule_version,
            explanation=verdict.explanation, matched_indicators=list(verdict.matched_indicators),
            limitations=list(verdict.limitations),
        )

    def _unsupported_execution(self, index: int, case: SecurityCase, message: str,
                               digest: str = "", started=None) -> RawExecution:
        verdict = evaluator.unsupported_verdict(case, message)
        now = utc_now()
        return RawExecution(
            index=index, test_id=case.test_id, test_version=case.version,
            started_at=started or now, completed_at=now, input_digest=digest,
            error_kind="unsupported", error_message=message, status=verdict.status,
            rule_id=verdict.rule_id, rule_version=verdict.rule_version,
            explanation=verdict.explanation, matched_indicators=list(verdict.matched_indicators),
            limitations=list(verdict.limitations),
        )

    def _single_execution(self, index: int, case: SecurityCase, adapter: ModelAdapter, request: RunRequest, run_id: str = "") -> RawExecution:
        started = utc_now()
        case_input = case.build_input()
        digest = hashlib.sha256(
            f"{case_input.system_prompt}\n---\n{case_input.user_prompt}".encode()).hexdigest()

        # Capability validation: check if model supports what this test requires
        if case.required_capabilities and hasattr(adapter, "capabilities"):
            for cap in case.required_capabilities:
                if not getattr(adapter.capabilities, cap, False):
                    return self._unsupported_execution(
                        index, case,
                        f"Target model '{adapter.model}' ({getattr(adapter, 'provider', adapter.name)}) lacks "
                        f"the required '{cap}' capability for test '{case.test_id}'.",
                        digest, started)

        total = len(case_input.system_prompt) + len(case_input.user_prompt)
        if total > self.settings.max_prompt_length:
            return self._error_execution(index, case, "prompt_too_long",
                                         "Test prompt exceeds the configured maximum length.",
                                         digest, started)

        req_payload = TargetRequest(
            system_prompt=case_input.system_prompt,
            user_prompt=case_input.user_prompt,
            images=case_input.images,
            tools=case_input.tools,
            schema_constraint=case_input.schema_constraint,
            temperature=request.target.temperature or 0.0,
        )

        log_test_dispatched(
            run_id=run_id or "direct",
            test_id=case.test_id,
            test_name=case.name,
            category=case.category.value if hasattr(case.category, "value") else str(case.category),
            provider=getattr(adapter, "provider", adapter.name),
            model=adapter.model,
            system_prompt=case_input.system_prompt,
            user_prompt=case_input.user_prompt,
        )

        try:
            resp = adapter.generate(req_payload)
        except TargetUnsupportedError as exc:
            log_security_test_run(
                run_id=run_id or "direct",
                test_id=case.test_id,
                test_name=case.name,
                category=case.category.value if hasattr(case.category, "value") else str(case.category),
                expected_behavior=case.expected_behavior,
                provider=getattr(adapter, "provider", adapter.name),
                model=adapter.model,
                system_prompt=case_input.system_prompt,
                user_prompt=case_input.user_prompt,
                verdict="UNSUPPORTED",
                explanation=exc.public_message,
                rule_id=case.rule_id,
                rule_version=case.rule_version,
                matched_indicators=["unsupported"],
            )
            return self._unsupported_execution(index, case, exc.public_message, digest, started)
        except TargetError as exc:
            log_security_test_run(
                run_id=run_id or "direct",
                test_id=case.test_id,
                test_name=case.name,
                category=case.category.value if hasattr(case.category, "value") else str(case.category),
                expected_behavior=case.expected_behavior,
                provider=getattr(adapter, "provider", adapter.name),
                model=adapter.model,
                system_prompt=case_input.system_prompt,
                user_prompt=case_input.user_prompt,
                verdict="ERROR",
                explanation=exc.public_message,
                rule_id=case.rule_id,
                rule_version=case.rule_version,
                matched_indicators=[f"target_{exc.kind}"],
            )
            return self._error_execution(index, case, exc.kind, exc.public_message, digest, started)

        verdict = evaluator.evaluate(case, resp.text, resp.truncated)
        token_usage_dict = resp.token_usage.to_dict() if resp.token_usage else None

        log_security_test_run(
            run_id=run_id or "direct",
            test_id=case.test_id,
            test_name=case.name,
            category=case.category.value if hasattr(case.category, "value") else str(case.category),
            expected_behavior=case.expected_behavior,
            provider=resp.provider or getattr(adapter, "provider", adapter.name),
            model=adapter.model,
            system_prompt=case_input.system_prompt,
            user_prompt=case_input.user_prompt,
            verdict=verdict.status.value if hasattr(verdict.status, "value") else str(verdict.status),
            explanation=verdict.explanation,
            rule_id=verdict.rule_id,
            rule_version=verdict.rule_version,
            matched_indicators=list(verdict.matched_indicators),
            latency_ms=resp.latency_ms,
            token_usage=token_usage_dict,
            output_preview=resp.text,
        )

        return RawExecution(
            index=index, test_id=case.test_id, test_version=case.version, started_at=started,
            completed_at=utc_now(), input_digest=digest, output_text=resp.text,
            output_truncated=resp.truncated, latency_ms=resp.latency_ms, status=verdict.status,
            rule_id=verdict.rule_id, rule_version=verdict.rule_version,
            explanation=verdict.explanation, matched_indicators=list(verdict.matched_indicators),
            limitations=list(verdict.limitations),
            token_usage=token_usage_dict,
            provider=resp.provider or getattr(adapter, "provider", adapter.name),
        )

    # ------------------------------------------------------------------ queries ---
    def get_run(self, run_id: str) -> RunRecord | None:
        raw = self.db.get_raw(run_id)
        if raw is None:
            return None
        return self.evidence.export_run(raw, self.db.infra_summary(run_id))
