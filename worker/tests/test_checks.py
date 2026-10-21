"""Unit tests for isolation checks verifying PASS, FAIL, ERROR, and INCONCLUSIVE behaviors."""

import errno
import socket
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from worker.checks.docker_socket import DockerSocketCheck
from worker.checks.user_privileges import UserPrivilegesCheck
from worker.checks.dropped_capabilities import DroppedCapabilitiesCheck
from worker.checks.resource_limits import ResourceLimitsCheck
from worker.checks.workspace_isolation import WorkspaceIsolationCheck
from worker.checks.host_filesystem import HostFilesystemProtectionCheck
from worker.checks.network_egress import NetworkEgressCheck
from worker.models import CheckStatus


# --- Docker Socket Check Tests ---

def test_docker_socket_absent():
    check = DockerSocketCheck()
    with patch.object(Path, "exists", return_value=False), patch.dict("os.environ", {}, clear=True):
        res = check.run({})
        assert res.status == CheckStatus.PASS
        assert res.observed == res.expected


def test_docker_socket_present(tmp_path):
    check = DockerSocketCheck()
    fake_sock = tmp_path / "docker.sock"
    fake_sock.touch()
    with patch("worker.checks.docker_socket.PROBE_SOCKET_PATHS", [str(fake_sock)]):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "docker socket detected" in res.observed
        assert res.observed != res.expected


def test_docker_socket_env_var_detected():
    check = DockerSocketCheck()
    with patch.object(Path, "exists", return_value=False), patch.dict("os.environ", {"DOCKER_HOST": "tcp://evil:2375"}):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "DOCKER_HOST" in res.observed


# --- User Privileges Check Tests ---

def test_user_privileges_non_root():
    check = UserPrivilegesCheck()
    with patch("os.getuid", return_value=10001, create=True), patch("os.getgid", return_value=10001, create=True):
        res = check.run({})
        assert res.status == CheckStatus.PASS
        assert res.observed == res.expected


def test_user_privileges_root_fails():
    check = UserPrivilegesCheck()
    with patch("os.getuid", return_value=0, create=True), patch("os.getgid", return_value=0, create=True):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "root" in res.observed


# --- Dropped Capabilities Check Tests ---

def test_capabilities_all_dropped():
    check = DroppedCapabilitiesCheck()
    proc_content = "CapInh:\t0000000000000000\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\n"
    with patch.object(Path, "exists", return_value=True), patch.object(Path, "read_text", return_value=proc_content):
        res = check.run({})
        assert res.status == CheckStatus.PASS
        assert res.observed == res.expected


def test_capabilities_retained_fails():
    check = DroppedCapabilitiesCheck()
    proc_content = "CapInh:\t0000000000000000\nCapPrm:\t00000000a80425fb\nCapEff:\t00000000a80425fb\nCapBnd:\t00000000a80425fb\n"
    with patch.object(Path, "exists", return_value=True), patch.object(Path, "read_text", return_value=proc_content):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "effective capabilities retained" in res.observed


def test_capabilities_missing_procfs_unavailable():
    check = DroppedCapabilitiesCheck()
    with patch.object(Path, "exists", return_value=False):
        res = check.run({})
        assert res.status == CheckStatus.UNAVAILABLE
        assert res.limitation is not None


# --- Resource Limits Check Tests ---

def test_resource_limits_cgroup_v2_bounded(tmp_path):
    check = ResourceLimitsCheck()
    cg_dir = tmp_path / "cgroup"
    cg_dir.mkdir()
    (cg_dir / "memory.max").write_text("268435456\n")  # 256 MiB
    (cg_dir / "pids.max").write_text("64\n")

    res = check.run({"cgroup_root": str(cg_dir)})
    assert res.status == CheckStatus.PASS
    assert res.observed == res.expected


def test_resource_limits_unbounded_fails(tmp_path):
    check = ResourceLimitsCheck()
    cg_dir = tmp_path / "cgroup"
    cg_dir.mkdir()
    (cg_dir / "memory.max").write_text("max\n")
    (cg_dir / "pids.max").write_text("max\n")

    res = check.run({"cgroup_root": str(cg_dir)})
    assert res.status == CheckStatus.FAIL
    assert "unbounded" in res.observed


# --- Workspace Isolation Check Tests ---

def test_workspace_isolation_pass(tmp_path):
    check = WorkspaceIsolationCheck()
    ws = tmp_path / "ws1"
    adj = tmp_path / "ws2"
    ws.mkdir()
    # adj does not exist or has protected file inaccessible
    res = check.run({"workspace_dir": str(ws), "adjacent_workspace_dir": str(adj)})
    assert res.status == CheckStatus.PASS
    assert res.observed == res.expected


def test_workspace_isolation_cross_read_breach(tmp_path):
    check = WorkspaceIsolationCheck()
    ws = tmp_path / "ws1"
    adj = tmp_path / "ws2"
    ws.mkdir()
    adj.mkdir()
    secret = adj / "protected_secret.txt"
    secret.write_text("CONFIDENTIAL_OTHER_WORKER_SECRET")

    res = check.run({"workspace_dir": str(ws), "adjacent_workspace_dir": str(adj)})
    assert res.status == CheckStatus.FAIL
    assert "cross-workspace isolation breach" in res.observed


# --- Host Filesystem Protection Check Tests ---

def test_host_filesystem_protection_pass():
    check = HostFilesystemProtectionCheck()
    with patch.object(Path, "is_file", return_value=False), patch.object(Path, "is_dir", return_value=False):
        res = check.run({})
        assert res.status == CheckStatus.PASS
        assert res.observed == res.expected


def test_host_filesystem_protection_breach(tmp_path):
    check = HostFilesystemProtectionCheck()
    fake_shadow = tmp_path / "shadow"
    fake_shadow.write_text("root:$6$hash:19000:0:99999:7:::")

    with patch("worker.checks.host_filesystem.PROHIBITED_HOST_PATHS", [str(fake_shadow)]):
        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "prohibited host access detected" in res.observed


# --- Network Egress Check Tests ---

def test_network_egress_strict_loopback_only():
    check = NetworkEgressCheck()
    # Mock interfaces returning only 'lo'
    with patch("socket.if_nameindex", return_value=[(1, "lo")]), \
         patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock_cls.return_value = mock_sock
        # Connect raises ENETUNREACH
        mock_sock.connect.side_effect = OSError(errno.ENETUNREACH, "Network unreachable")

        res = check.run({})
        assert res.status == CheckStatus.PASS
        assert res.observed == res.expected


def test_network_egress_leak_detected():
    check = NetworkEgressCheck()
    with patch("socket.if_nameindex", return_value=[(1, "lo"), (2, "eth0")]), \
         patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock_cls.return_value = mock_sock
        # Connect succeeds without error
        mock_sock.connect.return_value = None

        res = check.run({})
        assert res.status == CheckStatus.FAIL
        assert "outbound egress permitted" in res.observed


def test_network_egress_unproven_timeout_with_eth0():
    check = NetworkEgressCheck()
    with patch("socket.if_nameindex", return_value=[(1, "lo"), (2, "eth0")]), \
         patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock_cls.return_value = mock_sock
        mock_sock.connect.side_effect = socket.timeout("timed out")

        res = check.run({})
        # Should NOT claim PASS because eth0 is present and connection merely timed out
        assert res.status == CheckStatus.INCONCLUSIVE
        assert res.limitation is not None
