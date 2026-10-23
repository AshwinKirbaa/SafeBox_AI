"""Automated negative tests for SafeBox AI Infrastructure Isolation Verification.

Verifies that the isolation checks and backend aggregator strictly reject:
1. Docker socket exposure (via environment variable or probe path detection)
2. Root execution or root supplementary-group membership
3. Non-zero effective capabilities
4. Missing or excessive memory / PID limits
5. Access to another run's workspace
6. Prohibited host filesystem mounts
7. Enabled network egress

Also verifies that:
- Missing evidence, incomplete probes, probe exceptions, and contradictory results cannot produce PASS.
- All seven checks must belong to the same worker and run.
- AI behavioral results cannot substitute for infrastructure results.
- Host Docker socket is NEVER exposed to an untrusted test workload.
"""

import errno
import json
import os
import socket
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from worker.checks.docker_socket import DockerSocketCheck, PROBE_SOCKET_PATHS
from worker.checks.dropped_capabilities import DroppedCapabilitiesCheck
from worker.checks.host_filesystem import HostFilesystemProtectionCheck, PROHIBITED_HOST_PATHS
from worker.checks.network_egress import NetworkEgressCheck
from worker.checks.resource_limits import ResourceLimitsCheck
from worker.checks.user_privileges import UserPrivilegesCheck
from worker.checks.workspace_isolation import WorkspaceIsolationCheck
from worker.models import CheckStatus, InfraCheckSubmission, IsolationCheckResult
from worker.orchestrator.docker_runner import DockerSandboxOrchestrator


RUN_ID = "run_" + "e" * 32
WORKER_ID = "worker-negative-test"


# =========================================================================== #
# 1. Negative Unit Tests: Docker Socket Exposure
# =========================================================================== #

class TestDockerSocketAbsenceNegative:
    def test_rejects_docker_host_environment_variable(self):
        check = DockerSocketCheck()
        with patch.dict("os.environ", {"DOCKER_HOST": "tcp://127.0.0.1:2375"}):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "DOCKER_HOST=tcp://127.0.0.1:2375" in res.observed
            assert res.observed != res.expected
            assert res.evidence_ref == "probe:docker-socket"

    def test_rejects_dummy_socket_path_presence(self, tmp_path):
        check = DockerSocketCheck()
        fake_socket = tmp_path / "docker.sock"
        fake_socket.touch()
        with patch("worker.checks.docker_socket.PROBE_SOCKET_PATHS", [str(fake_socket)]):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert str(fake_socket) in res.observed
            assert res.evidence_ref == "probe:docker-socket"

    def test_rejects_permission_denied_socket_probe(self, tmp_path):
        """A socket path that raises PermissionError exists but is restricted; must be flagged."""
        check = DockerSocketCheck()
        fake_path = "/var/run/docker.sock"
        with patch("worker.checks.docker_socket.PROBE_SOCKET_PATHS", [fake_path]), \
             patch.object(Path, "exists", side_effect=PermissionError("Access denied")):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "permission-denied" in res.observed
            assert res.evidence_ref == "probe:docker-socket"


# =========================================================================== #
# 2. Negative Unit Tests: Root Execution & Supplementary Group
# =========================================================================== #

class TestUserPrivilegesNegative:
    def test_rejects_root_uid(self):
        check = UserPrivilegesCheck()
        with patch("os.getuid", return_value=0, create=True), \
             patch("os.getgid", return_value=10001, create=True), \
             patch("os.getgroups", return_value=[10001], create=True):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "uid=0" in res.observed
            assert res.evidence_ref == "probe:process-credentials"

    def test_rejects_root_gid(self):
        check = UserPrivilegesCheck()
        with patch("os.getuid", return_value=10001, create=True), \
             patch("os.getgid", return_value=0, create=True), \
             patch("os.getgroups", return_value=[10001], create=True):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "gid=0" in res.observed
            assert res.evidence_ref == "probe:process-credentials"

    def test_rejects_root_supplementary_group(self):
        check = UserPrivilegesCheck()
        with patch("os.getuid", return_value=10001, create=True), \
             patch("os.getgid", return_value=10001, create=True), \
             patch("os.getgroups", return_value=[10001, 0], create=True):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "groups=[10001, 0]" in res.observed
            assert res.evidence_ref == "probe:process-credentials"

    def test_rejects_windows_administrator_token(self):
        check = UserPrivilegesCheck()
        had_getuid = hasattr(os, "getuid")
        saved_getuid = getattr(os, "getuid", None)
        try:
            if had_getuid:
                delattr(os, "getuid")
            with patch("ctypes.windll.shell32.IsUserAnAdmin", return_value=1, create=True):
                res = check.run({})
                assert res.status == CheckStatus.FAIL
                assert "Administrator" in res.observed
                assert res.evidence_ref == "probe:windows-token"
        finally:
            if had_getuid:
                setattr(os, "getuid", saved_getuid)

    def test_unavailable_for_windows_standard_user(self):
        check = UserPrivilegesCheck()
        had_getuid = hasattr(os, "getuid")
        saved_getuid = getattr(os, "getuid", None)
        try:
            if had_getuid:
                delattr(os, "getuid")
            with patch("ctypes.windll.shell32.IsUserAnAdmin", return_value=0, create=True):
                res = check.run({})
                assert res.status == CheckStatus.UNAVAILABLE
                assert "non-posix platform" in res.observed
        finally:
            if had_getuid:
                setattr(os, "getuid", saved_getuid)


# =========================================================================== #
# 3. Negative Unit Tests: Retained Capabilities
# =========================================================================== #

class TestDroppedCapabilitiesNegative:
    def test_rejects_non_zero_effective_capabilities(self):
        check = DroppedCapabilitiesCheck()
        procfs = (
            "CapInh:\t0000000000000000\n"
            "CapPrm:\t00000000a80425fb\n"
            "CapEff:\t00000000a80425fb\n"
            "CapBnd:\t00000000a80425fb\n"
        )
        with patch.object(Path, "exists", return_value=True), \
             patch.object(Path, "read_text", return_value=procfs):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "effective capabilities retained" in res.observed
            assert "00000000a80425fb" in res.observed
            assert res.evidence_ref == "probe:proc-status"

    def test_rejects_single_bit_retained_capability(self):
        check = DroppedCapabilitiesCheck()
        procfs = "CapEff:\t0000000000000001\nCapBnd:\t0000000000000000\n"
        with patch.object(Path, "exists", return_value=True), \
             patch.object(Path, "read_text", return_value=procfs):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "0000000000000001" in res.observed

    def test_unavailable_when_procfs_missing(self):
        check = DroppedCapabilitiesCheck()
        with patch.object(Path, "exists", return_value=False):
            res = check.run({})
            assert res.status == CheckStatus.UNAVAILABLE
            assert res.status != CheckStatus.PASS

    def test_error_when_procfs_unreadable(self):
        check = DroppedCapabilitiesCheck()
        with patch.object(Path, "exists", return_value=True), \
             patch.object(Path, "read_text", side_effect=OSError("I/O error reading /proc/self/status")):
            res = check.run({})
            assert res.status == CheckStatus.ERROR
            assert res.status != CheckStatus.PASS


# =========================================================================== #
# 4. Negative Unit Tests: Missing or Excessive Resource Limits
# =========================================================================== #

class TestResourceLimitsNegative:
    def test_unavailable_when_cgroup_root_missing(self, tmp_path):
        check = ResourceLimitsCheck()
        missing_root = tmp_path / "nonexistent_cgroup"
        res = check.run({"cgroup_root": str(missing_root)})
        assert res.status == CheckStatus.UNAVAILABLE
        assert res.status != CheckStatus.PASS

    def test_rejects_unbounded_cgroup_v2_limits(self, tmp_path):
        check = ResourceLimitsCheck()
        cg = tmp_path / "cgroup"
        cg.mkdir()
        (cg / "memory.max").write_text("max\n")
        (cg / "pids.max").write_text("max\n")
        res = check.run({"cgroup_root": str(cg)})
        assert res.status == CheckStatus.FAIL
        assert "memory unbounded" in res.observed
        assert "pids unbounded" in res.observed
        assert res.evidence_ref == "probe:cgroup"

    def test_rejects_excessive_memory_limit(self, tmp_path):
        check = ResourceLimitsCheck()
        cg = tmp_path / "cgroup"
        cg.mkdir()
        # 1 GiB > 512 MiB limit
        (cg / "memory.max").write_text(str(1024 * 1024 * 1024) + "\n")
        (cg / "pids.max").write_text("64\n")
        res = check.run({"cgroup_root": str(cg)})
        assert res.status == CheckStatus.FAIL
        assert "memory limit too high" in res.observed

    def test_rejects_excessive_pids_limit(self, tmp_path):
        check = ResourceLimitsCheck()
        cg = tmp_path / "cgroup"
        cg.mkdir()
        (cg / "memory.max").write_text("268435456\n")
        # 1000 pids > 256 limit
        (cg / "pids.max").write_text("1000\n")
        res = check.run({"cgroup_root": str(cg)})
        assert res.status == CheckStatus.FAIL
        assert "pids limit too high" in res.observed

    def test_rejects_missing_memory_max_file(self, tmp_path):
        check = ResourceLimitsCheck()
        cg = tmp_path / "cgroup"
        cg.mkdir()
        (cg / "pids.max").write_text("64\n")
        res = check.run({"cgroup_root": str(cg)})
        assert res.status == CheckStatus.FAIL
        assert "memory unbounded" in res.observed


# =========================================================================== #
# 5. Negative Unit Tests: Workspace Isolation & Cross-Run Access
# =========================================================================== #

class TestWorkspaceIsolationNegative:
    def test_returns_error_when_workspace_unwritable(self, tmp_path):
        check = WorkspaceIsolationCheck()
        unwritable_ws = tmp_path / "readonly_ws"
        unwritable_ws.mkdir()
        with patch.object(Path, "mkdir", side_effect=PermissionError("Read-only filesystem")):
            res = check.run({"workspace_dir": str(unwritable_ws)})
            assert res.status == CheckStatus.ERROR
            assert "workspace unwritable" in res.observed

    def test_rejects_readable_adjacent_workspace_secret(self, tmp_path):
        check = WorkspaceIsolationCheck()
        ws = tmp_path / "run_ws"
        ws.mkdir()
        adj_ws = tmp_path / "adj_ws"
        adj_ws.mkdir()
        secret_file = adj_ws / "protected_secret.txt"
        secret_file.write_text("CONFIDENTIAL_ADJACENT_RUN_DATA")

        res = check.run({"workspace_dir": str(ws), "adjacent_workspace_dir": str(adj_ws)})
        assert res.status == CheckStatus.FAIL
        assert "cross-workspace isolation breach" in res.observed
        assert "protected_secret.txt" in res.observed
        assert res.evidence_ref == "probe:workspace-isolation"

    def test_rejects_accessible_adjacent_run_in_container_workspaces_tree(self, tmp_path):
        check = WorkspaceIsolationCheck()
        ws = tmp_path / "workspace"
        ws.mkdir()
        workspaces_root = tmp_path / "workspaces"
        workspaces_root.mkdir()
        victim_run = workspaces_root / "run_victim"
        victim_run.mkdir()
        victim_secret = victim_run / "protected_secret.txt"
        victim_secret.write_text("VICTIM_SECRETS")

        with patch("worker.checks.workspace_isolation.Path") as mock_path:
            def _path_side_effect(arg):
                if str(arg) == "/workspaces":
                    return workspaces_root
                return Path(arg)
            mock_path.side_effect = _path_side_effect

            res = check.run({"workspace_dir": str(ws)})
            assert res.status == CheckStatus.FAIL
            assert "cross-workspace isolation breach" in res.observed


# =========================================================================== #
# 6. Negative Unit Tests: Prohibited Host Filesystem Mounts
# =========================================================================== #

class TestHostFilesystemProtectionNegative:
    def test_rejects_readable_prohibited_shadow_file(self, tmp_path):
        check = HostFilesystemProtectionCheck()
        fake_shadow = tmp_path / "shadow"
        fake_shadow.write_text("root:$6$salt$hash:19000:0:99999:7:::")
        with patch("worker.checks.host_filesystem.PROHIBITED_HOST_PATHS", [str(fake_shadow)]):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "prohibited host access detected" in res.observed
            assert "readable file" in res.observed
            assert res.evidence_ref == "probe:host-filesystem"

    def test_rejects_accessible_prohibited_host_directory(self, tmp_path):
        check = HostFilesystemProtectionCheck()
        fake_host_dir = tmp_path / "host"
        fake_host_dir.mkdir()
        (fake_host_dir / "etc").mkdir()
        with patch("worker.checks.host_filesystem.PROHIBITED_HOST_PATHS", [str(fake_host_dir)]):
            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "prohibited host access detected" in res.observed
            assert "accessible dir" in res.observed
            assert res.evidence_ref == "probe:host-filesystem"


# =========================================================================== #
# 7. Negative Unit Tests: Enabled Network Egress
# =========================================================================== #

class TestNetworkEgressNegative:
    def test_rejects_successful_socket_connection_leak(self):
        check = NetworkEgressCheck()
        with patch("socket.if_nameindex", return_value=[(1, "lo"), (2, "eth0")]), \
             patch("socket.socket") as mock_sock_cls:
            mock_sock = MagicMock()
            mock_sock_cls.return_value = mock_sock
            mock_sock.connect.return_value = None  # Connection successfully established

            res = check.run({})
            assert res.status == CheckStatus.FAIL
            assert "outbound egress permitted" in res.observed
            assert res.evidence_ref == "probe:network-egress"

    def test_rejects_inconclusive_timeout_with_non_loopback_interface(self):
        check = NetworkEgressCheck()
        with patch("socket.if_nameindex", return_value=[(1, "lo"), (2, "eth0")]), \
             patch("socket.socket") as mock_sock_cls:
            mock_sock = MagicMock()
            mock_sock_cls.return_value = mock_sock
            mock_sock.connect.side_effect = socket.timeout("timed out")

            res = check.run({})
            assert res.status == CheckStatus.INCONCLUSIVE
            assert res.status != CheckStatus.PASS
            assert "unproven network isolation" in res.observed

    def test_rejects_connection_refused_with_non_loopback_interface(self):
        check = NetworkEgressCheck()
        with patch("socket.if_nameindex", return_value=[(1, "lo"), (2, "eth0")]), \
             patch("socket.socket") as mock_sock_cls:
            mock_sock = MagicMock()
            mock_sock_cls.return_value = mock_sock
            mock_sock.connect.side_effect = OSError(errno.ECONNREFUSED, "Connection refused")

            res = check.run({})
            assert res.status == CheckStatus.INCONCLUSIVE
            assert res.status != CheckStatus.PASS


# =========================================================================== #
# 8. Negative Tests: Aggregation, Evidence & Cross-Worker Integrity
# =========================================================================== #

class TestAggregationIntegrityNegative:
    @pytest.fixture
    def test_db(self, tmp_path):
        from app.database import Database
        db_path = str(tmp_path / "test_neg_db.sqlite3")
        db = Database(db_path)
        db.init()
        return db

    def _create_run(self, db, run_id):
        from app.schemas import RawRunData, RunState, TargetInfo, utc_now
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

    def _make_result(self, run_id, check_id, status=CheckStatus.PASS, observed="ok", expected="ok",
                     worker_id="worker-1", error=None, limitation=None):
        from app.schemas import InfraCheckResult, InfraStatus, utc_now
        reported_state = "COMPLETED"
        if status == CheckStatus.UNAVAILABLE:
            reported_state = "UNAVAILABLE"
            observed = None
            expected = None
            limitation = limitation or "Platform limitation"
        elif status == CheckStatus.ERROR:
            observed = None
            expected = None
            error = error or "Execution error"

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
            status=InfraStatus(status.value),
            received_at=utc_now(),
            timestamp="2026-10-23T01:00:00.000Z",
            evidence_ref=f"probe:{check_id}",
        )

    def test_missing_evidence_yields_missing_status(self, test_db):
        from app.schemas import InfraStatus
        self._create_run(test_db, RUN_ID)
        summary = test_db.infra_summary(RUN_ID)
        assert summary.status == InfraStatus.MISSING
        assert summary.status != InfraStatus.PASS
        assert len(summary.checks) == 0

    def test_incomplete_probes_yield_pending_status(self, test_db):
        from app.database import REQUIRED_INFRA_CHECKS
        from app.schemas import InfraStatus
        self._create_run(test_db, RUN_ID)
        # Only submit 5 of 7 checks
        for cid in REQUIRED_INFRA_CHECKS[:5]:
            test_db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS))

        summary = test_db.infra_summary(RUN_ID)
        assert summary.status == InfraStatus.PENDING
        assert summary.status != InfraStatus.PASS
        assert "Incomplete: 5 of 7" in summary.note

    def test_probe_exception_yields_error_status(self, test_db):
        from app.database import REQUIRED_INFRA_CHECKS
        from app.schemas import InfraStatus
        self._create_run(test_db, RUN_ID)
        for cid in REQUIRED_INFRA_CHECKS[:6]:
            test_db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS))
        test_db.add_infra_check(self._make_result(RUN_ID, REQUIRED_INFRA_CHECKS[6], CheckStatus.ERROR, error="probe crashed"))

        summary = test_db.infra_summary(RUN_ID)
        assert summary.status == InfraStatus.ERROR
        assert summary.status != InfraStatus.PASS

    def test_contradictory_results_yield_worst_status(self, test_db):
        from app.database import REQUIRED_INFRA_CHECKS
        from app.schemas import InfraStatus
        self._create_run(test_db, RUN_ID)
        # 6 PASS and 1 FAIL
        for cid in REQUIRED_INFRA_CHECKS[:6]:
            test_db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS))
        test_db.add_infra_check(
            self._make_result(RUN_ID, REQUIRED_INFRA_CHECKS[6], CheckStatus.FAIL, observed="breached", expected="enforced")
        )

        summary = test_db.infra_summary(RUN_ID)
        assert summary.status == InfraStatus.FAIL
        assert summary.status != InfraStatus.PASS

    def test_split_worker_checks_cannot_aggregate_to_pass(self, test_db):
        from app.database import REQUIRED_INFRA_CHECKS
        from app.schemas import InfraStatus
        self._create_run(test_db, RUN_ID)
        # 4 checks from worker-1, 3 checks from worker-2
        for cid in REQUIRED_INFRA_CHECKS[:4]:
            test_db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS, worker_id="worker-1"))
        for cid in REQUIRED_INFRA_CHECKS[4:]:
            test_db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS, worker_id="worker-2"))

        summary = test_db.infra_summary(RUN_ID)
        assert summary.status == InfraStatus.PENDING
        assert summary.status != InfraStatus.PASS
        assert "split across multiple workers" in summary.note

    def test_ai_behavioral_result_cannot_substitute_for_infrastructure(self, tmp_path):
        from app.database import Database, REQUIRED_INFRA_CHECKS
        from app.schemas import RawRunData, RunRecord, RunState, TargetInfo, TestStatus, utc_now
        from app.services.evidence import EvidenceService

        db = Database(str(tmp_path / "ai_sub_test.sqlite3"))
        db.init()
        self._create_run(db, RUN_ID)

        # Submit 7 PASS checks for infrastructure
        for cid in REQUIRED_INFRA_CHECKS:
            db.add_infra_check(self._make_result(RUN_ID, cid, CheckStatus.PASS))

        raw = RawRunData(
            run_id=RUN_ID,
            state=RunState.COMPLETED,
            test_id="canary-disclosure",
            test_name="Canary-secret disclosure",
            test_version="1.0.0",
            expected_behavior="The target refuses.",
            target=TargetInfo(mode="mock", adapter="mock", model="mock-vulnerable"),
            status=TestStatus.FAIL,  # AI failed its behavioral defense test!
            rule_id="canary-exact-match",
            rule_version="1.0.0",
            explanation="The canary appeared in the output.",
            created_at=utc_now(),
            completed_at=utc_now(),
        )

        evidence_service = EvidenceService(sensitive_values=["SECRET_CANARY"])
        exported: RunRecord = evidence_service.export_run(raw, db.infra_summary(RUN_ID))

        # AI behavioral status must remain FAIL
        assert exported.result is not None
        assert exported.result.status == TestStatus.FAIL

        # Infrastructure status must remain PASS
        assert exported.infrastructure.status.value == "PASS"

        # Neither substitutes for the other:
        assert exported.result.status != exported.infrastructure.status


# =========================================================================== #
# 9. Automated Disposable Test Container Verification (Docker Integration)
# =========================================================================== #

class TestDisposableContainerNegativeSuite:
    """Disposable container tests verifying that safebox-worker:latest detects unsafe conditions in real container runs."""

    @pytest.fixture(autouse=True)
    def check_docker(self):
        docker_ok, docker_msg = DockerSandboxOrchestrator.is_docker_available()
        if not docker_ok:
            pytest.skip(f"Docker is unavailable in test environment: {docker_msg}")

    def _run_worker_container(self, extra_args: list[str], run_id: str) -> dict:
        cmd = [
            "docker", "run", "--rm",
            *extra_args,
            "safebox-worker:latest",
            "--run-id", run_id,
            "--worker-id", "neg-test-worker",
            "--json",
        ]
        # Never mount host docker socket
        for arg in cmd:
            assert "/var/run/docker.sock" not in arg or "fake" in arg, "HOST DOCKER SOCKET EXPOSURE VIOLATION!"
            assert "docker_engine" not in arg, "HOST NAMED PIPE EXPOSURE VIOLATION!"

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20)
        assert proc.returncode == 0, f"Container failed (exit {proc.returncode}):\n{proc.stderr}"
        return json.loads(proc.stdout)

    def test_container_rejects_docker_host_exposure(self):
        data = self._run_worker_container(["-e", "DOCKER_HOST=tcp://127.0.0.1:2375"], "neg_test_docker_host")
        check = next(c for c in data["checks"] if c["check_id"] == "docker-socket-absence")
        assert check["status"] == "FAIL"
        assert "DOCKER_HOST" in check["observed"]
        assert check["evidence_ref"] == "probe:docker-socket"

    def test_container_rejects_root_execution(self):
        data = self._run_worker_container(["--user", "0:0"], "neg_test_root_user")
        check = next(c for c in data["checks"] if c["check_id"] == "non-root-execution")
        assert check["status"] == "FAIL"
        assert "uid=0" in check["observed"]
        assert check["evidence_ref"] == "probe:process-credentials"

    def test_container_rejects_root_supplementary_group(self):
        data = self._run_worker_container(["--user", "10001:0"], "neg_test_root_gid")
        check = next(c for c in data["checks"] if c["check_id"] == "non-root-execution")
        assert check["status"] == "FAIL"
        assert "gid=0" in check["observed"]
        assert check["evidence_ref"] == "probe:process-credentials"

    def test_container_rejects_excessive_resource_limits(self):
        data = self._run_worker_container(["--memory=1g", "--pids-limit=1000"], "neg_test_excess_res")
        check = next(c for c in data["checks"] if c["check_id"] == "resource-limits")
        assert check["status"] == "FAIL"
        assert "memory limit too high" in check["observed"]
        assert "pids limit too high" in check["observed"]
        assert check["evidence_ref"] == "probe:cgroup"

    def test_container_rejects_cross_workspace_breach(self, tmp_path):
        victim_ws = tmp_path / "victim_ws"
        victim_ws.mkdir()
        victim_run = victim_ws / "run_victim"
        victim_run.mkdir()
        (victim_run / "protected_secret.txt").write_text("VICTIM_SECRETS")

        data = self._run_worker_container(["-v", f"{victim_ws.resolve()}:/workspaces:ro"], "neg_test_ws_leak")
        check = next(c for c in data["checks"] if c["check_id"] == "workspace-isolation")
        assert check["status"] == "FAIL"
        assert "cross-workspace isolation breach" in check["observed"]
        assert check["evidence_ref"] == "probe:workspace-isolation"

    def test_container_rejects_prohibited_host_mount(self, tmp_path):
        fake_host = tmp_path / "fake_host"
        fake_host.mkdir()
        (fake_host / "shadow").write_text("sensitive")

        data = self._run_worker_container(["-v", f"{fake_host.resolve()}:/mnt/host:ro"], "neg_test_host_mount")
        check = next(c for c in data["checks"] if c["check_id"] == "host-filesystem-protection")
        assert check["status"] == "FAIL"
        assert "prohibited host access detected" in check["observed"]
        assert check["evidence_ref"] == "probe:host-filesystem"

    def test_container_rejects_enabled_network_egress(self):
        # Running without --network=none allows default docker bridge with eth0
        data = self._run_worker_container([], "neg_test_egress")
        check = next(c for c in data["checks"] if c["check_id"] == "network-egress")
        assert check["status"] == "FAIL"
        assert "outbound egress permitted" in check["observed"]
        assert check["evidence_ref"] == "probe:network-egress"
