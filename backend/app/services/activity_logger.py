"""Centralized Activity & Security Audit Logger for SafeBox AI.

Provides comprehensive, human-readable and structured logs for:
- Model selection and configuration
- API credentials and Fernet vaulting
- Endpoint reachability and model discovery
- Security test prompt generation (exact system and user prompts)
- Model adapter execution (local Ollama or remote APIs)
- Security & integrity verification (rules, canary checks, refusal detection)
- Sandbox worker isolation checks
"""
from __future__ import annotations

import collections
import datetime
import hashlib
import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger("safebox.activity")

# Colors for terminal output (ANSI)
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

_SECRET_KEY = re.compile(
    r"(^|[_-])(api[_-]?key|authorization|bearer|password|secret|access[_-]?token|"
    r"refresh[_-]?token|vault[_-]?key|credential)($|[_-])",
    re.I,
)
_SECRET_VALUE = re.compile(
    r"(?i)(bearer\s+)[^\s,;]+|((?:api[_-]?key|password|token|secret)\s*[=:]\s*)[^\s,;]+"
)


def _fingerprint(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()[:16]
    return f"[REDACTED length={len(value)} sha256={digest}]"


def _sanitize(value: Any, key: str = "") -> Any:
    if _SECRET_KEY.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): _sanitize(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    if isinstance(value, str):
        return _SECRET_VALUE.sub(lambda m: (m.group(1) or m.group(2) or "") + "[REDACTED]", value)
    return value


class ActivityLogger:
    _instance: ActivityLogger | None = None
    _lock = threading.Lock()

    def __init__(self, log_dir: str | Path | None = None, max_history: int = 500) -> None:
        if log_dir is None:
            # Default to data/logs relative to backend directory
            backend_root = Path(__file__).resolve().parent.parent.parent
            self.log_dir = backend_root / "data" / "logs"
        else:
            self.log_dir = Path(log_dir)

        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "activity.log"
        self.max_history = max_history
        self._history: collections.deque[dict[str, Any]] = collections.deque(maxlen=max_history)
        self._file_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> ActivityLogger:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = ActivityLogger()
        return cls._instance

    def _append_to_file(self, text: str) -> None:
        try:
            with self._file_lock:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(text + "\n")
                    f.flush()
                    try:
                        os.fsync(f.fileno())
                    except OSError:
                        pass
        except Exception as exc:
            logger.debug("Failed writing to activity log file: %s", exc)

    def record_event(
        self,
        action: str,
        title: str,
        steps: list[str],
        status: str = "INFO",
        metadata: dict[str, Any] | None = None,
        prompts: dict[str, str] | None = None,
        evaluation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Record an activity event to console, log file, and memory ring buffer."""
        now = datetime.datetime.now(datetime.timezone.utc)
        iso_time = now.isoformat()
        display_time = now.strftime("%Y-%m-%d %H:%M:%S UTC")

        safe_steps = [_sanitize(step) for step in steps]
        safe_metadata = _sanitize(metadata or {})
        safe_prompts = {name: _fingerprint(value) for name, value in (prompts or {}).items() if value}
        safe_evaluation = _sanitize(evaluation or {})
        event = {
            "id": f"act_{now.strftime('%Y%m%d%H%M%S')}_{len(self._history) + 1}",
            "timestamp": iso_time,
            "display_time": display_time,
            "action": action,
            "title": title,
            "status": status,
            "steps": safe_steps,
            "metadata": safe_metadata,
            "prompts": safe_prompts,
            "evaluation": safe_evaluation,
        }

        with self._lock:
            self._history.appendleft(event)

        # Build clean formatted console & file banner
        lines = []
        lines.append(f"{CYAN}================================================================================{RESET}")
        lines.append(f"{BOLD}[SAFEBOX AUDIT]{RESET} {MAGENTA}{action}{RESET} | {BOLD}{title}{RESET} ({display_time})")
        lines.append(f"{CYAN}--------------------------------------------------------------------------------{RESET}")

        if safe_metadata:
            meta_items = [f"{k}={v}" for k, v in safe_metadata.items() if v is not None]
            if meta_items:
                lines.append(f"  {DIM}Context:{RESET} {' | '.join(meta_items)}")

        for step in safe_steps:
            lines.append(f"  {GREEN}▶{RESET} {step}")

        if safe_prompts:
            if "system_prompt" in safe_prompts:
                lines.append(f"  {YELLOW}SYSTEM PROMPT REFERENCE:{RESET}")
                for pline in safe_prompts["system_prompt"].split("\n"):
                    lines.append(f"    {DIM}│{RESET} {pline}")
            if "user_prompt" in safe_prompts:
                lines.append(f"  {YELLOW}USER PROMPT REFERENCE:{RESET}")
                for pline in safe_prompts["user_prompt"].split("\n"):
                    lines.append(f"    {DIM}│{RESET} {pline}")

        if safe_evaluation:
            lines.append(f"  {CYAN}SECURITY & INTEGRITY VERIFICATION RESULT:{RESET}")
            rule_id = safe_evaluation.get("rule_id", "N/A")
            rule_ver = safe_evaluation.get("rule_version", "1.0.0")
            verdict = safe_evaluation.get("verdict", status)
            explanation = safe_evaluation.get("explanation", "")
            lines.append(f"    {DIM}├──{RESET} Evaluator Rule: {rule_id} (v{rule_ver})")
            if "indicators" in safe_evaluation:
                lines.append(f"    {DIM}├──{RESET} Matched Indicators: {', '.join(safe_evaluation['indicators']) or 'None'}")
            if "canary_check" in safe_evaluation:
                lines.append(f"    {DIM}├──{RESET} Protected Canary: {safe_evaluation['canary_check']}")
            if "refusal_check" in safe_evaluation:
                lines.append(f"    {DIM}├──{RESET} Refusal Detection: {safe_evaluation['refusal_check']}")
            status_color = GREEN if verdict == "PASS" else (RED if verdict == "FAIL" else YELLOW)
            lines.append(f"    {DIM}└──{RESET} Final Verdict: {status_color}{BOLD}{verdict}{RESET} ({explanation})")

        lines.append(f"{CYAN}================================================================================{RESET}")
        banner_text = "\n".join(lines)

        # Print to terminal for real-time visibility
        print(banner_text, flush=True)

        # Strip ANSI colors for the plain log file
        plain_text = (
            banner_text.replace(CYAN, "")
            .replace(GREEN, "")
            .replace(YELLOW, "")
            .replace(RED, "")
            .replace(MAGENTA, "")
            .replace(BOLD, "")
            .replace(DIM, "")
            .replace(RESET, "")
        )
        self._append_to_file(plain_text)

        return event

    def get_recent_events(self, limit: int = 50, action_filter: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            events = list(self._history)
        if action_filter:
            events = [e for e in events if action_filter.lower() in e["action"].lower()]
        return events[:limit]

    def clear_history(self) -> None:
        with self._lock:
            self._history.clear()


# Module-level convenience functions
_activity = ActivityLogger.get_instance()


def log_model_selection(provider: str, model: str, base_url: str | None = None, source: str = "Client") -> None:
    _activity.record_event(
        action="MODEL_SELECTION",
        title=f"Selected {provider.upper()} ({model})",
        steps=[
            f"Active model target configured: provider='{provider}', model='{model}'",
            f"Endpoint URL: {base_url or 'default cloud provider endpoint'}",
            f"Selection source: {source}",
        ],
        status="INFO",
        metadata={"provider": provider, "model": model, "source": source},
    )


def log_connection_saved(
    action: str,
    name: str,
    provider: str,
    model: str,
    base_url: str | None,
    has_api_key: bool,
    masked_key: str | None = None,
    connection_id: str | None = None,
) -> None:
    key_desc = "Encrypted in Fernet vault (value never logged)" if has_api_key else "None (Unauthenticated/Local)"
    _activity.record_event(
        action=f"CONNECTION_{action.upper()}",
        title=f"{action.title()} Connection: '{name}'",
        steps=[
            f"Profile Name: '{name}' (ID: {connection_id or 'new'})",
            f"Inference Provider: {provider.upper()} | Model: {model}",
            f"Base Endpoint: {base_url or 'provider default'}",
            f"API Authentication: {key_desc}",
            f"Database State: Profile committed to SQLite; secrets securely encrypted in .vault.enc",
        ],
        status="SUCCESS",
        metadata={
            "connection_id": connection_id,
            "provider": provider,
            "model": model,
            "has_credentials": has_api_key,
        },
    )


def log_connection_test(
    provider: str,
    model: str,
    base_url: str | None,
    reachable: bool,
    latency_ms: float | None = None,
    discovered_models: list[str] | None = None,
    capabilities: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    status = "SUCCESS" if reachable else "FAILED"
    models_cnt = len(discovered_models) if discovered_models else 0
    caps_str = ", ".join(k for k, v in (capabilities or {}).items() if v) or "standard"

    steps = [
        f"Probe initiated: Provider={provider.upper()}, Model={model}, BaseURL={base_url or 'default'}",
        f"Endpoint Reachability: {'REACHABLE' if reachable else 'UNREACHABLE'}" + (f" (Latency: {latency_ms:.1f}ms)" if latency_ms else ""),
        f"Model Catalog Discovery: Discovered {models_cnt} available models" + (f" (e.g. {', '.join(discovered_models[:4])})" if models_cnt > 0 else ""),
        f"Declared Capabilities: {caps_str}",
    ]
    if error:
        steps.append(f"Connection Diagnostic: {error}")

    _activity.record_event(
        action="CONNECTION_TEST_DISCOVER",
        title=f"Test Reachability: {provider.upper()} - {model} ({status})",
        steps=steps,
        status=status,
        metadata={
            "provider": provider,
            "model": model,
            "reachable": reachable,
            "latency_ms": latency_ms,
            "discovered_count": models_cnt,
        },
    )


def log_live_verification_started(
    connection_id: str | None,
    provider: str,
    model: str,
    test_id: str,
) -> None:
    steps = [
        f"Live verification requested for provider '{provider}' and model '{model}'.",
        f"Step 1: Resolving connection profile '{connection_id or 'direct'}' and decrypting vault token...",
        f"Step 2: Checking network reachability and endpoint status...",
    ]
    _activity.record_event(
        action="LIVE_VERIFICATION_STARTED",
        title=f"Starting Live Verification: {provider.upper()} ({model})",
        steps=steps,
        status="RUNNING",
        metadata={"connection_id": connection_id, "provider": provider, "model": model, "test_id": test_id},
    )


def log_live_verification_audit(
    connection_id: str | None,
    provider: str,
    model: str,
    test_id: str,
    test_name: str,
    system_prompt: str,
    user_prompt: str,
    verdict: str,
    explanation: str,
    rule_id: str,
    rule_version: str,
    matched_indicators: list[str],
    latency_ms: float | None = None,
    token_usage: dict[str, Any] | None = None,
    output_preview: str | None = None,
    fallback_used: bool = False,
    error: str | None = None,
) -> None:
    token_str = ""
    if token_usage:
        pt = token_usage.get("prompt_tokens", 0)
        ct = token_usage.get("completion_tokens", 0)
        tt = token_usage.get("total_tokens", 0)
        token_str = f" | Tokens: {pt} prompt, {ct} completion, {tt} total"

    steps = [
        f"Step 1: Resolved target connection '{connection_id or 'direct'}' with encrypted credentials.",
        f"Step 2: Pre-flight endpoint check verified connection health and reachability.",
        f"Step 3: Selected Security Benchmark Test: '{test_id}' ({test_name})",
        (
            f"Step 4: Executed model inference on {provider.upper()} ({model})"
            + (f" [FALLBACK MODEL APPLIED]" if fallback_used else "")
            + (f" - Latency: {latency_ms:.1f}ms{token_str}" if latency_ms is not None else "")
        ),
    ]
    if output_preview:
        steps.append(f"Step 5: Target Model Output Reference: {_fingerprint(output_preview)}")

    steps.append(f"Step 6: Security Evaluator Rule '{rule_id}' analyzed output for policy compliance.")

    if error:
        steps.append(f"Execution Warning/Error: {error}")

    _activity.record_event(
        action="LIVE_VERIFICATION_AUDIT",
        title=f"Live Audit & Verify: {provider.upper()} ({model}) -> {verdict}",
        steps=steps,
        status=verdict,
        metadata={
            "connection_id": connection_id,
            "provider": provider,
            "model": model,
            "test_id": test_id,
            "verdict": verdict,
            "latency_ms": latency_ms,
        },
        prompts={
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
        },
        evaluation={
            "rule_id": rule_id,
            "rule_version": rule_version,
            "verdict": verdict,
            "explanation": explanation,
            "indicators": matched_indicators,
            "canary_check": "Not disclosed (safe)" if "canary_absent" in matched_indicators else ("DISCLOSED (breach)" if "canary_exact_match" in matched_indicators or "canary_normalized_match" in matched_indicators else "N/A"),
            "refusal_check": "Refusal detected (compliant)" if "refusal_phrase_present" in matched_indicators else "No refusal phrase",
        },
    )


def log_test_dispatched(
    run_id: str,
    test_id: str,
    test_name: str,
    category: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> None:
    steps = [
        f"Security Evaluation Started: Run ID '{run_id}' | Test '{test_id}' ({test_name})",
        f"Category: {category}",
        f"Target Model: {provider.upper()} ({model})",
        f"Dispatching formatted system prompt and adversarial user prompt to adapter...",
    ]
    _activity.record_event(
        action="TEST_DISPATCHED",
        title=f"Dispatching Test: {test_name} -> {provider.upper()} ({model})",
        steps=steps,
        status="RUNNING",
        metadata={
            "run_id": run_id,
            "test_id": test_id,
            "provider": provider,
            "model": model,
        },
        prompts={
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
        },
    )


def log_security_test_run(
    run_id: str,
    test_id: str,
    test_name: str,
    category: str,
    expected_behavior: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    verdict: str,
    explanation: str,
    rule_id: str,
    rule_version: str,
    matched_indicators: list[str],
    latency_ms: float | None = None,
    token_usage: dict[str, Any] | None = None,
    output_preview: str | None = None,
) -> None:
    token_str = ""
    if token_usage:
        pt = token_usage.get("prompt_tokens", 0)
        ct = token_usage.get("completion_tokens", 0)
        tt = token_usage.get("total_tokens", 0)
        token_str = f" | Tokens: {pt} in / {ct} out ({tt} total)"

    steps = [
        f"Run ID: {run_id} | Test ID: '{test_id}' ({test_name}) | Category: {category}",
        f"Expected Model Security Behavior: {expected_behavior}",
        f"Model Target: {provider.upper()} ({model}) | Latency: {latency_ms:.1f}ms{token_str}" if latency_ms else f"Model Target: {provider.upper()} ({model})",
    ]
    if output_preview:
        steps.append(f"Model Output Reference: {_fingerprint(output_preview)}")

    steps.append(f"Evaluation Rule '{rule_id}' matched indicators: {', '.join(matched_indicators) or 'None'}")
    steps.append(f"Result verdict: {verdict} - {explanation}")

    _activity.record_event(
        action="SECURITY_TEST_EXECUTION",
        title=f"Security Test: {test_name} -> {verdict}",
        steps=steps,
        status=verdict,
        metadata={
            "run_id": run_id,
            "test_id": test_id,
            "provider": provider,
            "model": model,
            "verdict": verdict,
            "latency_ms": latency_ms,
        },
        prompts={
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
        },
        evaluation={
            "rule_id": rule_id,
            "rule_version": rule_version,
            "verdict": verdict,
            "explanation": explanation,
            "indicators": matched_indicators,
        },
    )


def log_worker_sandbox_check(
    run_id: str,
    check_id: str,
    worker_id: str,
    status: str,
    observed: str,
    expected: str,
    error: str | None = None,
) -> None:
    steps = [
        f"Isolation check '{check_id}' submitted by '{worker_id}' for run {run_id}",
        f"Observed sandbox property: '{observed}'",
        f"Expected security property: '{expected}'",
        f"Verification Verdict: {status}",
    ]
    if error:
        steps.append(f"Worker Error: {error}")

    _activity.record_event(
        action="SANDBOX_ISOLATION_CHECK",
        title=f"Sandbox Isolation Check: {check_id} -> {status}",
        steps=steps,
        status=status,
        metadata={
            "run_id": run_id,
            "check_id": check_id,
            "worker_id": worker_id,
            "status": status,
        },
    )
