"""Tests for Infrastructure Isolation Verification and Run Association.

Verifies:
1. Cross-run isolation: checks for run A never appear in run B.
2. Complete checks requirement: PASS strictly requires all 7 required checks.
   Any subset (e.g. 6 of 7) remains PENDING/NOT VERIFIED.
3. Host fallback results are never claimed as hardened-container PASS.
4. Duplicate submissions are rejected with DuplicateInfraResult (HTTP 409).
5. Clean re-verification: clear_infra_checks permits fresh verification.
"""
import pytest

from app.database import Database, DuplicateInfraResult, REQUIRED_INFRA_CHECKS
from app.schemas import (
    InfraCheckResult,
    InfraCheckSubmission,
    InfraStatus,
    RawRunData,
    RunState,
    TargetInfo,
    utc_now,
)


@pytest.fixture
def test_db(tmp_path):
    db_path = str(tmp_path / "test_infra.sqlite3")
    db = Database(db_path)
    db.init()
    return db


def _make_run(db: Database, run_id: str) -> None:
    raw = RawRunData(
        run_id=run_id,
        state=RunState.COMPLETED,
        test_id="canary-disclosure",
        test_name="Canary-secret disclosure",
        test_version="1.0.0",
        expected_behavior="The target refuses.",
        target=TargetInfo(mode="mock", adapter="mock", model="mock-defended"),
        created_at=utc_now(),
        completed_at=utc_now(),
    )
    db.create_run(raw)


def _make_check(
    run_id: str,
    check_id: str,
    status: InfraStatus = InfraStatus.PASS,
    worker_id: str = "worker-1",
    limitation: str | None = None,
) -> InfraCheckResult:
    reported_state = "COMPLETED" if status in (InfraStatus.PASS, InfraStatus.FAIL) else "UNAVAILABLE"
    observed = "ok" if status == InfraStatus.PASS else ("breach" if status == InfraStatus.FAIL else None)
    expected = "ok" if status in (InfraStatus.PASS, InfraStatus.FAIL) else None
    lim = limitation or ("Docker unavailable" if status == InfraStatus.UNAVAILABLE else None)
    return InfraCheckResult(
        run_id=run_id,
        worker_id=worker_id,
        check_id=check_id,
        policy_id=f"policy-{check_id}",
        policy_version="1.0.0",
        received_at=utc_now(),
        status=status,
        reported_state=reported_state,
        observed=observed,
        expected=expected,
        timestamp=utc_now().isoformat(),
        evidence_ref=f"probe:{check_id}",
        limitation=lim,
    )


def test_infra_checks_strictly_isolated_between_runs(test_db):
    run_a = "run_" + "a" * 32
    run_b = "run_" + "b" * 32
    _make_run(test_db, run_a)
    _make_run(test_db, run_b)

    # Submit 7 checks for run A
    for cid in REQUIRED_INFRA_CHECKS:
        test_db.add_infra_check(_make_check(run_a, cid, InfraStatus.PASS))

    # Run A has 7 checks and PASS
    summary_a = test_db.infra_summary(run_a)
    assert summary_a.status == InfraStatus.PASS
    assert len(summary_a.checks) == 7

    # Run B has ZERO checks and MISSING
    summary_b = test_db.infra_summary(run_b)
    assert summary_b.status == InfraStatus.MISSING
    assert len(summary_b.checks) == 0


def test_incomplete_checks_subset_never_passes(test_db):
    run_id = "run_" + "c" * 32
    _make_run(test_db, run_id)

    # Submit 6 of 7 required checks
    partial = REQUIRED_INFRA_CHECKS[:6]
    for cid in partial:
        test_db.add_infra_check(_make_check(run_id, cid, InfraStatus.PASS))

    summary = test_db.infra_summary(run_id)
    # Must be PENDING, never PASS!
    assert summary.status == InfraStatus.PENDING
    assert len(summary.checks) == 6
    assert "Incomplete: 6 of 7" in (summary.note or "")


def test_all_seven_checks_allow_aggregate_pass(test_db):
    run_id = "run_" + "d" * 32
    _make_run(test_db, run_id)

    for cid in REQUIRED_INFRA_CHECKS:
        test_db.add_infra_check(_make_check(run_id, cid, InfraStatus.PASS))

    summary = test_db.infra_summary(run_id)
    assert summary.status == InfraStatus.PASS
    assert len(summary.checks) == 7


def test_host_fallback_never_reported_as_container_pass(test_db):
    run_id = "run_" + "e" * 32
    _make_run(test_db, run_id)

    # In host fallback mode, checks are marked UNAVAILABLE or carry host limitation
    for cid in REQUIRED_INFRA_CHECKS:
        test_db.add_infra_check(
            _make_check(
                run_id,
                cid,
                status=InfraStatus.UNAVAILABLE,
                limitation="Host-fallback diagnostic (Docker unavailable)",
            )
        )

    summary = test_db.infra_summary(run_id)
    assert summary.status == InfraStatus.UNAVAILABLE
    assert summary.status != InfraStatus.PASS


def test_duplicate_submission_raises_error(test_db):
    run_id = "run_" + "f" * 32
    _make_run(test_db, run_id)

    check = _make_check(run_id, "docker-socket-absence", InfraStatus.PASS)
    test_db.add_infra_check(check)

    # Second submission with same run_id, worker_id, check_id must raise DuplicateInfraResult
    with pytest.raises(DuplicateInfraResult):
        test_db.add_infra_check(check)


def test_clear_infra_checks_allows_clean_reverification(test_db):
    run_id = "run_" + "1" * 32
    _make_run(test_db, run_id)

    check = _make_check(run_id, "docker-socket-absence", InfraStatus.FAIL)
    test_db.add_infra_check(check)
    assert len(test_db.infra_summary(run_id).checks) == 1

    # Clear prior checks
    deleted = test_db.clear_infra_checks(run_id)
    assert deleted == 1
    assert len(test_db.infra_summary(run_id).checks) == 0

    # Can now record updated check
    test_db.add_infra_check(_make_check(run_id, "docker-socket-absence", InfraStatus.PASS))
    assert test_db.infra_summary(run_id).checks[0].status == InfraStatus.PASS
