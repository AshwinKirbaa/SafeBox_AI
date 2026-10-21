"""Evidence handling: bounded, redacted exports of raw run data.

Raw data (RawRunData) is persisted as-is. The API only ever returns the output of
``export_run``, which redacts every registered canary / prohibited string,
limits excerpt size, and carries no prompts, environment values or hidden reasoning.
"""
from __future__ import annotations

import re
from typing import Iterable

from app.schemas import (
    EvaluationResult,
    EvidenceItem,
    EvidenceRef,
    InfrastructureSummary,
    RawRunData,
    RunRecord,
    TokenUsageSummary,
    utc_now,
)

REDACTION_MARK = "[REDACTED]"
# Catches canary-like strings in the registered families even if not registered.
_FAMILY_RE = re.compile(r"\b(?:CANARY|PROHIBITED|INJECTION|DIRECTIVE)-[A-Za-z0-9_-]+", re.IGNORECASE)


def _tolerant_pattern(value: str) -> str:
    """Match the value regardless of case and of separators between its characters."""
    chars = [re.escape(ch) for ch in value if ch.isalnum()]
    return r"[\W_]*".join(chars)


class EvidenceService:
    def __init__(self, sensitive_values: Iterable[str], max_excerpt_chars: int = 500) -> None:
        values = sorted({v for v in sensitive_values if v}, key=len, reverse=True)
        self._patterns = [re.compile(_tolerant_pattern(v), re.IGNORECASE) for v in values]
        self.max_excerpt_chars = max_excerpt_chars

    def redact(self, text: str) -> tuple[str, bool]:
        redacted = False
        for pattern in (*self._patterns, _FAMILY_RE):
            text, n = pattern.subn(REDACTION_MARK, text)
            redacted = redacted or n > 0
        return text, redacted

    def excerpt(self, text: str) -> tuple[str, bool, bool]:
        """(excerpt, redacted, truncated). Redacts BEFORE cutting so no partial secret survives."""
        clean, redacted = self.redact(text)
        if len(clean) > self.max_excerpt_chars:
            return clean[: self.max_excerpt_chars], redacted, True
        return clean, redacted, False

    def export_run(self, raw: RawRunData, infrastructure: InfrastructureSummary) -> RunRecord:
        """Build the public presentation from raw data."""
        items: list[EvidenceItem] = []

        def add(kind, content, *, execution_index=None, observed_status=None,
                rule_id=None, rule_version=None, truncated=False, redacted=False) -> None:
            items.append(EvidenceItem(
                evidence_id=f"ev-{len(items) + 1:02d}", run_id=raw.run_id, test_id=raw.test_id,
                kind=kind, content=content, redacted=redacted, truncated=truncated,
                size_chars=len(content), execution_index=execution_index,
                observed_status=observed_status, rule_id=rule_id, rule_version=rule_version,
                recorded_at=raw.completed_at or raw.created_at,
            ))

        definition, def_redacted = self.redact(
            f"{raw.test_name} v{raw.test_version}. Expected: {raw.expected_behavior}")
        add("test_definition", definition, redacted=def_redacted)

        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_tokens = 0
        has_usage = False
        observed_latency = None

        for ex in raw.executions:
            if ex.latency_ms is not None:
                observed_latency = max(observed_latency or 0, ex.latency_ms)
            if ex.token_usage:
                has_usage = True
                total_prompt_tokens += ex.token_usage.get("prompt_tokens") or 0
                total_completion_tokens += ex.token_usage.get("completion_tokens") or 0
                total_tokens += ex.token_usage.get("total_tokens") or 0

            if ex.output_text is not None:
                text, redacted, cut = self.excerpt(ex.output_text)
                add("model_output", text, execution_index=ex.index, observed_status=ex.status,
                    rule_id=ex.rule_id, rule_version=ex.rule_version,
                    truncated=cut or ex.output_truncated, redacted=redacted)
            else:
                msg, redacted = self.redact(f"{ex.error_kind}: {ex.error_message}")
                add("target_error", msg, execution_index=ex.index, observed_status=ex.status,
                    rule_id=ex.rule_id, rule_version=ex.rule_version, redacted=redacted)

        token_summary = TokenUsageSummary(
            prompt_tokens=total_prompt_tokens or None,
            completion_tokens=total_completion_tokens or None,
            total_tokens=total_tokens or None,
        ) if has_usage else None

        result: EvaluationResult | None = None
        if raw.status is not None and raw.rule_id and raw.rule_version:
            explanation, redacted = self.redact(raw.explanation or "")
            add("rule_result", explanation, observed_status=raw.status,
                rule_id=raw.rule_id, rule_version=raw.rule_version, redacted=redacted)
            result = EvaluationResult(
                test_id=raw.test_id, test_version=raw.test_version, rule_id=raw.rule_id,
                rule_version=raw.rule_version, status=raw.status, explanation=explanation,
                evidence_refs=[EvidenceRef(evidence_id=i.evidence_id, kind=i.kind) for i in items],
                started_at=raw.created_at, completed_at=raw.completed_at or utc_now(),
                matched_indicators=list(raw.matched_indicators),
                limitations=list(raw.limitations), repeatability=raw.repeatability,
                token_usage=token_summary, observed_latency_ms=observed_latency,
            )

        return RunRecord(
            run_id=raw.run_id, state=raw.state, test_id=raw.test_id, test_version=raw.test_version,
            target=raw.target, created_at=raw.created_at, completed_at=raw.completed_at,
            result=result, evidence=items, infrastructure=infrastructure,
        )
