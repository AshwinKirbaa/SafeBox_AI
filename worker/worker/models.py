"""Data models for Member 2 infrastructure isolation checks.

Matches the Member 1 backend API contracts defined in INTEGRATION.md.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"
    PENDING = "PENDING"
    UNAVAILABLE = "UNAVAILABLE"
    INCONCLUSIVE = "INCONCLUSIVE"  # Mapped to UNAVAILABLE or explicit limitation when submitting


class ReportedState(str, Enum):
    COMPLETED = "COMPLETED"
    PENDING = "PENDING"
    UNAVAILABLE = "UNAVAILABLE"


_Short = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$")]
RunId = Annotated[str, Field(pattern=r"^run_[0-9a-f]{32}$")]


class InfraCheckSubmission(BaseModel):
    """Schema expected by POST /api/security-tests/runs/{run_id}/infrastructure-checks."""

    model_config = ConfigDict(extra="forbid")

    worker_id: _Short
    run_id: RunId
    check_id: _Short
    policy_id: _Short
    policy_version: _Short
    reported_state: Literal["COMPLETED", "PENDING", "UNAVAILABLE"] = "COMPLETED"
    observed: str | None = Field(None, max_length=500)
    expected: str | None = Field(None, max_length=500)
    evidence_ref: str | None = Field(None, max_length=256)
    timestamp: str = Field(description="ISO 8601 UTC timestamp ending in Z")
    error: str | None = Field(None, max_length=500)
    limitation: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def _validate_state(self) -> "InfraCheckSubmission":
        if self.reported_state == "COMPLETED" and not self.error:
            if self.observed is None or self.expected is None:
                raise ValueError("COMPLETED checks require both 'observed' and 'expected'")
        if self.reported_state == "UNAVAILABLE" and not (self.error or self.limitation):
            raise ValueError("UNAVAILABLE checks must explain why via 'error' or 'limitation'")
        return self


class IsolationCheckResult(BaseModel):
    """Local result of an isolation check executed inside or outside container."""

    check_id: str
    policy_id: str
    policy_version: str = "1.0.0"
    status: CheckStatus
    expected: str
    observed: str
    evidence_ref: str | None = None
    evidence_detail: str | None = None
    error: str | None = None
    limitation: str | None = None
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    )

    def to_submission(self, worker_id: str, run_id: str) -> InfraCheckSubmission:
        """Convert local check result to Member 1 backend submission payload."""
        if self.error:
            return InfraCheckSubmission(
                worker_id=worker_id,
                run_id=run_id,
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                reported_state="COMPLETED",
                observed=self.observed[:500] if self.observed else None,
                expected=self.expected[:500] if self.expected else None,
                evidence_ref=self.evidence_ref[:256] if self.evidence_ref else None,
                timestamp=self.timestamp,
                error=self.error[:500],
                limitation=self.limitation[:500] if self.limitation else None,
            )
        elif self.status == CheckStatus.PENDING:
            return InfraCheckSubmission(
                worker_id=worker_id,
                run_id=run_id,
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                reported_state="PENDING",
                observed=None,
                expected=None,
                evidence_ref=self.evidence_ref[:256] if self.evidence_ref else None,
                timestamp=self.timestamp,
                error=None,
                limitation=self.limitation[:500] if self.limitation else None,
            )
        elif self.status in (CheckStatus.UNAVAILABLE, CheckStatus.INCONCLUSIVE):
            lim = self.limitation or (f"Inconclusive verdict: {self.observed}" if self.status == CheckStatus.INCONCLUSIVE else "Check unavailable")
            return InfraCheckSubmission(
                worker_id=worker_id,
                run_id=run_id,
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                reported_state="UNAVAILABLE",
                observed=None,
                expected=None,
                evidence_ref=self.evidence_ref[:256] if self.evidence_ref else None,
                timestamp=self.timestamp,
                error=None,
                limitation=lim[:500],
            )
        elif self.status == CheckStatus.PASS:
            # Under Member 1 contract: COMPLETED -> PASS if observed == expected
            return InfraCheckSubmission(
                worker_id=worker_id,
                run_id=run_id,
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                reported_state="COMPLETED",
                observed=self.expected[:500],  # Equal to expected produces PASS
                expected=self.expected[:500],
                evidence_ref=self.evidence_ref[:256] if self.evidence_ref else None,
                timestamp=self.timestamp,
                error=None,
                limitation=self.limitation[:500] if self.limitation else None,
            )
        else:  # FAIL
            # Ensure observed != expected so Member 1 derives FAIL
            obs = self.observed if self.observed != self.expected else f"VIOLATION: {self.observed}"
            return InfraCheckSubmission(
                worker_id=worker_id,
                run_id=run_id,
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                reported_state="COMPLETED",
                observed=obs[:500],
                expected=self.expected[:500],
                evidence_ref=self.evidence_ref[:256] if self.evidence_ref else None,
                timestamp=self.timestamp,
                error=None,
                limitation=self.limitation[:500] if self.limitation else None,
            )
