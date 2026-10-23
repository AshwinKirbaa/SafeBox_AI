"""Tests for Failure Handling, Evidence Integrity, Run Association, and Stale Check Prevention.

Verifies:
1. A check reporting a genuine security violation is never marked PASS and causes aggregate FAIL.
2. Infrastructure check submissions with blank or whitespace-only observed/expected/error/limitation
   are rejected with 422 / ValidationError and can never yield PASS.
3. Checks that are UNAVAILABLE or encounter execution ERROR never aggregate to PASS.
4. Run isolation: evidence from one run is strictly isolated from another run.
5. Re-running a worker clears prior checks and never leaves stale checks that falsely report PASS.
"""

import pytest
from pydantic import ValidationError

from app.database import REQUIRED_INFRA_CHECKS, Database, DuplicateInfraResult
from app.schemas import (
    InfraCheckResult,
    InfraCheckSubmission,
    InfraStatus,
    RawRunData,
    RunRecord,
    RunState,
    TargetInfo,
    utc_now,
)
from tests.conftest import run as run_ai_test
from tests.test_api import infra_body


RUN_1 = "run_" + "1" * 32
RUN_2 = "run_" + "2" * 32
NOW = "2026-10-23T01:00:00.000Z"


@pytest.fixture
def test_db(tmp_path):
    db_path = str(tmp_path / "test_integrity.sqlite3")
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


def _check(
    run_id: str,
    check_id: str,
    status: InfraStatus = InfraStatus.PASS,
    observed: str | None = "ok",
    expected: str | None = "ok",
    error: str | None = None,
    limitation: str | None = None,
    worker_id: str = "worker-1",
) -> InfraCheckResult:
    reported_state = "COMPLETED"
    if status == InfraStatus.UNAVAILABLE:
        reported_state = "UNAVAILABLE"
        observed = None
        expected = None
        limitation = limitation or "Check unavailable on this platform"
    elif status == InfraStatus.ERROR:
        reported_state = "COMPLETED"
        observed = None
        expected = None
        error = error or "Execution error encountered"
    elif status == InfraStatus.FAIL:
        observed = observed or "security_violation_detected"
        expected = expected or "security_boundary_enforced"

    return InfraCheckResult(
        run_id=run_id,
        worker_id=worker_id,
        check_id=check_id,
        policy_id=f"policy-{check_id}",
        policy_version="1.0.0",
        reported_state=reported_state,
        observed=observed,
        expected=expected,
        error=error,
        limitation=limitation,
        status=status,
        received_at=utc_now(),
        timestamp=NOW,
        evidence_ref=f"probe:{check_id}",
    )


# =========================================================================== #
# 1. Genuine Security Violation Handling
# =========================================================================== #

def test_genuine_security_violation_is_marked_fail_and_fails_run(client):
    """A genuine security breach (observed != expected) derives FAIL, not PASS, and overrides other checks."""
    ai_run = run_ai_test(client, behavior="defended").json()
    rid = ai_run["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"

    # Submit 6 passing checks (all except non-root-execution)
    passing_checks = [c for c in REQUIRED_INFRA_CHECKS if c != "non-root-execution"]
    for cid in passing_checks:
        r = client.post(url, json=infra_body(rid, check_id=cid, observed="enforced", expected="enforced"))
        assert r.status_code == 201
        assert r.json()["status"] == "PASS"

    # Submit 7th check reporting a genuine privilege violation (running as root)
    breach_body = infra_body(
        rid,
        check_id="non-root-execution",
        policy_id="non-root-user",
        observed="executed as privileged root user (uid=0, gid=0)",
        expected="executed by unprivileged non-root user (uid > 0)",
    )
    r_breach = client.post(url, json=breach_body)
    assert r_breach.status_code == 201
    assert r_breach.json()["status"] == "FAIL"

    # Overall run infrastructure status must be FAIL, NEVER PASS
    rec = client.get(f"/api/security-tests/runs/{rid}").json()
    assert rec["infrastructure"]["status"] == "FAIL"
    # AI behavior result remains completely truthful and decoupled
    assert rec["result"]["status"] == "PASS"


# =========================================================================== #
# 2. Blank and Whitespace-Only Value Rejection
# =========================================================================== #

def test_schema_rejects_blank_and_whitespace_observed_or_expected():
    """InfraCheckSubmission must reject blank or whitespace-only observed and expected values."""
    base = dict(
        worker_id="w1",
        run_id=RUN_1,
        check_id="network-egress",
        policy_id="pol",
        policy_version="1",
        timestamp=NOW,
    )

    # Empty strings
    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", observed="", expected="")

    # Whitespace-only strings
    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", observed="   ", expected="   ")

    # One blank, one valid
    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", observed="valid_value", expected="   ")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", observed="  \t  ", expected="valid_value")

    # Blank error or limitation
    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", error="   ")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="COMPLETED", limitation="   ", observed="ok", expected="ok")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, reported_state="UNAVAILABLE", limitation="   ", error="  ")


def test_api_rejects_blank_and_whitespace_submissions(client):
    """API endpoint returns 422 for blank or whitespace-only infrastructure check inputs."""
    ai_run = run_ai_test(client).json()
    rid = ai_run["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"

    # Blank observed and expected
    r1 = client.post(url, json=infra_body(rid, observed="", expected=""))
    assert r1.status_code == 422

    # Whitespace observed and expected
    r2 = client.post(url, json=infra_body(rid, observed="   ", expected="   "))
    assert r2.status_code == 422

    # Blank error
    r3 = client.post(url, json=infra_body(rid, observed=None, expected=None, error="   "))
    assert r3.status_code == 422

    # Blank limitation for UNAVAILABLE
    r4 = client.post(
        url,
        json=infra_body(rid, reported_state="UNAVAILABLE", observed=None, expected=None, limitation="   "),
    )
    assert r4.status_code == 422


# =========================================================================== #
# 3. Unavailable Check and Execution Error Handling
# =========================================================================== #

def test_unavailable_check_never_aggregates_to_pass(test_db):
    """If any check is UNAVAILABLE, aggregate status is UNAVAILABLE, never PASS."""
    _make_run(test_db, RUN_1)

    # 6 PASS checks
    for cid in REQUIRED_INFRA_CHECKS[:6]:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS))

    # 1 UNAVAILABLE check
    test_db.add_infra_check(
        _check(RUN_1, REQUIRED_INFRA_CHECKS[6], InfraStatus.UNAVAILABLE, limitation="Host missing cgroup v2")
    )

    summary = test_db.infra_summary(RUN_1)
    assert summary.status == InfraStatus.UNAVAILABLE
    assert summary.status != InfraStatus.PASS


def test_execution_error_never_aggregates_to_pass(test_db):
    """If any check encounters an execution ERROR, aggregate status is ERROR, never PASS."""
    _make_run(test_db, RUN_1)

    # 6 PASS checks
    for cid in REQUIRED_INFRA_CHECKS[:6]:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS))

    # 1 ERROR check
    test_db.add_infra_check(
        _check(RUN_1, REQUIRED_INFRA_CHECKS[6], InfraStatus.ERROR, error="Container process OOM killed")
    )

    summary = test_db.infra_summary(RUN_1)
    assert summary.status == InfraStatus.ERROR
    assert summary.status != InfraStatus.PASS


def test_api_derives_error_even_if_observed_equals_expected(client):
    """When an error is present, status is ERROR even if observed == expected."""
    ai_run = run_ai_test(client).json()
    rid = ai_run["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"

    body = infra_body(rid, observed="ok", expected="ok", error="Failed to verify socket cleanly")
    r = client.post(url, json=body)
    assert r.status_code == 201
    assert r.json()["status"] == "ERROR"
    assert r.json()["status"] != "PASS"


# =========================================================================== #
# 4. Run Association and Isolation
# =========================================================================== #

def test_evidence_and_checks_never_associated_with_another_run(client):
    """Checks submitted for Run 1 must never appear under Run 2, and ID mismatches must be rejected."""
    run1 = run_ai_test(client).json()["run_id"]
    run2 = run_ai_test(client).json()["run_id"]

    # Submit 7 checks for Run 1
    url1 = f"/api/security-tests/runs/{run1}/infrastructure-checks"
    for cid in REQUIRED_INFRA_CHECKS:
        client.post(url1, json=infra_body(run1, check_id=cid, observed=f"ev_{cid}", expected=f"ev_{cid}"))

    # Inspect Run 2
    rec2 = client.get(f"/api/security-tests/runs/{run2}").json()
    assert rec2["infrastructure"]["status"] == "MISSING"
    assert len(rec2["infrastructure"]["checks"]) == 0

    # Cross-submission attempt: body has run2, URL has run1 -> 422
    mismatch_resp = client.post(url1, json=infra_body(run2, check_id="network-egress"))
    assert mismatch_resp.status_code == 422
    assert mismatch_resp.json()["error"]["code"] == "run_id_mismatch"

    # Submission to non-existent run -> 404
    ghost = "run_" + "9" * 32
    ghost_resp = client.post(f"/api/security-tests/runs/{ghost}/infrastructure-checks", json=infra_body(ghost))
    assert ghost_resp.status_code == 404


# =========================================================================== #
# 5. Stale Check Prevention on Re-run
# =========================================================================== #

def test_rerun_clears_prior_checks_and_prevents_stale_pass(test_db):
    """When a run previously passed 7 checks, a re-run that only completes 3 checks must NOT report PASS."""
    _make_run(test_db, RUN_1)

    # Initial run: all 7 PASS
    for cid in REQUIRED_INFRA_CHECKS:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS))

    assert test_db.infra_summary(RUN_1).status == InfraStatus.PASS
    assert len(test_db.infra_summary(RUN_1).checks) == 7

    # Worker re-run starts: prior checks are cleared
    test_db.clear_infra_checks(RUN_1)
    assert test_db.infra_summary(RUN_1).status == InfraStatus.MISSING
    assert len(test_db.infra_summary(RUN_1).checks) == 0

    # Second execution only completes 3 checks before terminating
    for cid in REQUIRED_INFRA_CHECKS[:3]:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS))

    summary = test_db.infra_summary(RUN_1)
    # MUST NOT be PASS! Must report PENDING with note of missing checks
    assert summary.status == InfraStatus.PENDING
    assert summary.status != InfraStatus.PASS
    assert len(summary.checks) == 3
    assert "Incomplete: 3 of 7" in summary.note
    assert "PASS requires all of them" in summary.note


def test_duplicate_submission_without_clear_is_rejected(client):
    """Submitting duplicate checks without a clean re-run is rejected with 409."""
    ai_run = run_ai_test(client).json()
    rid = ai_run["run_id"]
    url = f"/api/security-tests/runs/{rid}/infrastructure-checks"

    body = infra_body(rid, check_id="network-egress", observed="blocked", expected="blocked")
    r1 = client.post(url, json=body)
    assert r1.status_code == 201

    # Attempt to re-submit same check
    r2 = client.post(url, json=body)
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "duplicate_check"


def test_split_worker_checks_cannot_aggregate_to_pass(test_db):
    """Checks fragmented across multiple workers cannot stitch together an aggregate PASS."""
    _make_run(test_db, RUN_1)

    # Worker A submits first 4 checks
    for cid in REQUIRED_INFRA_CHECKS[:4]:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS, worker_id="worker-A"))

    # Worker B submits remaining 3 checks
    for cid in REQUIRED_INFRA_CHECKS[4:]:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS, worker_id="worker-B"))

    summary = test_db.infra_summary(RUN_1)
    # Must be PENDING, never PASS, because no single worker verified all 7 checks
    assert summary.status == InfraStatus.PENDING
    assert summary.status != InfraStatus.PASS
    assert "split across multiple workers" in summary.note


def test_multi_worker_conflict_preserves_worst_status(test_db):
    """When multiple workers report on the same run, failure status takes strict precedence."""
    _make_run(test_db, RUN_1)

    # Worker A submits all 7 passing checks
    for cid in REQUIRED_INFRA_CHECKS:
        test_db.add_infra_check(_check(RUN_1, cid, InfraStatus.PASS, worker_id="worker-A"))

    # Worker B reports a failure on docker-socket-absence
    test_db.add_infra_check(_check(RUN_1, "docker-socket-absence", InfraStatus.FAIL, worker_id="worker-B"))

    summary = test_db.infra_summary(RUN_1)
    # Worst status (FAIL) must win
    assert summary.status == InfraStatus.FAIL

