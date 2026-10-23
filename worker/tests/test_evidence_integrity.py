"""Worker-side tests for Evidence Integrity, Non-blank Validation, and Failure Handling."""

import pytest
from pydantic import ValidationError

from worker.models import CheckStatus, InfraCheckSubmission, IsolationCheckResult


NOW = "2026-10-23T01:00:00.000Z"
RUN_ID = "run_" + "a" * 32


def test_worker_submission_rejects_blank_observed_and_expected():
    base = dict(
        worker_id="worker-1",
        run_id=RUN_ID,
        check_id="network-egress",
        policy_id="egress-deny-all",
        policy_version="1.0.0",
        reported_state="COMPLETED",
        timestamp=NOW,
    )

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, observed="", expected="")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, observed="   ", expected="   ")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, observed="valid", expected="  ")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, error="   ")

    with pytest.raises(ValidationError):
        InfraCheckSubmission(**base, limitation="   ")


def test_isolation_check_result_fail_produces_mismatched_submission():
    """A FAIL IsolationCheckResult must produce observed != expected in InfraCheckSubmission."""
    res = IsolationCheckResult(
        check_id="non-root-execution",
        policy_id="non-root-user",
        policy_version="1.0.0",
        status=CheckStatus.FAIL,
        expected="executed by unprivileged non-root user (uid > 0)",
        observed="executed as privileged root user (uid=0, gid=0)",
        evidence_ref="probe:process-credentials",
    )
    sub = res.to_submission(worker_id="worker-1", run_id=RUN_ID)
    assert sub.reported_state == "COMPLETED"
    assert sub.observed != sub.expected
    assert sub.observed.strip() != ""
    assert sub.expected.strip() != ""


def test_isolation_check_result_unavailable_produces_limitation():
    res = IsolationCheckResult(
        check_id="dropped-capabilities",
        policy_id="cap-drop-all",
        policy_version="1.0.0",
        status=CheckStatus.UNAVAILABLE,
        expected="all capabilities dropped",
        observed="procfs unavailable",
        limitation="/proc/self/status not available outside Linux container",
    )
    sub = res.to_submission(worker_id="worker-1", run_id=RUN_ID)
    assert sub.reported_state == "UNAVAILABLE"
    assert sub.observed is None
    assert sub.expected is None
    assert sub.limitation is not None
    assert sub.limitation.strip() != ""


def test_isolation_check_result_error_produces_error_submission():
    res = IsolationCheckResult(
        check_id="resource-limits",
        policy_id="bounded-resources",
        policy_version="1.0.0",
        status=CheckStatus.ERROR,
        expected="memory limits enforced",
        observed="read failure",
        error="cgroup filesystem read timed out",
    )
    sub = res.to_submission(worker_id="worker-1", run_id=RUN_ID)
    assert sub.error == "cgroup filesystem read timed out"
    assert sub.error.strip() != ""


def test_user_privileges_fails_with_root_supplementary_group():
    from unittest.mock import patch
    from worker.checks.user_privileges import UserPrivilegesCheck

    check = UserPrivilegesCheck()
    with patch("os.getuid", return_value=10001, create=True), \
         patch("os.getgid", return_value=10001, create=True), \
         patch("os.getgroups", return_value=[10001, 0], create=True):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "privileged root user or group" in res.observed
        assert res.observed != res.expected


def test_workspace_isolation_probes_container_workspaces_directory(tmp_path):
    from unittest.mock import patch
    from worker.checks.workspace_isolation import WorkspaceIsolationCheck

    check = WorkspaceIsolationCheck()
    designated_ws = tmp_path / "workspace"
    designated_ws.mkdir()
    alt_workspaces = tmp_path / "workspaces"
    alt_workspaces.mkdir()
    other_run_ws = alt_workspaces / "run_victim"
    other_run_ws.mkdir()
    secret = other_run_ws / "protected_secret.txt"
    secret.write_text("SENSITIVE_DATA")

    with patch("worker.checks.workspace_isolation.Path") as mock_path_cls:
        # Allow designated_ws to operate normally
        from pathlib import Path
        def _path_side_effect(p):
            if str(p) == "/workspaces":
                return alt_workspaces
            return Path(p)

        mock_path_cls.side_effect = _path_side_effect

        # When alt_workspaces is breached, check must fail
        res = check.run({"workspace_dir": str(designated_ws)})
        assert res.status == CheckStatus.FAIL
        assert "cross-workspace isolation breach" in res.observed

