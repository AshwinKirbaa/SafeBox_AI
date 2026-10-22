import json

"""Tests for DockerSandboxOrchestrator."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from worker.orchestrator.docker_runner import DockerSandboxOrchestrator


def test_build_docker_run_args():
    orchestrator = DockerSandboxOrchestrator(image_tag="safebox-worker:v1")
    run_id = "run_" + "e" * 32
    ws_path = Path("/tmp/test_workspace")

    args = orchestrator.build_docker_run_args(
        run_id,
        ws_path,
        worker_id="worker-test",
    )

    # Verify key hardening flags.
    assert "--user" in args and "10001:10001" in args
    assert "--security-opt=no-new-privileges:true" in args
    assert "--cap-drop=ALL" in args
    assert "--read-only" in args
    assert "--tmpfs" in args
    assert "/tmp:rw,noexec,nosuid,size=64m" in args
    assert "--memory=256m" in args
    assert "--memory-swap=256m" in args
    assert "--cpus=0.5" in args
    assert "--pids-limit=64" in args
    assert "--network=none" in args
    assert "--run-id" in args and run_id in args
    assert "--worker-id" in args and "worker-test" in args
    assert "--workspace-dir" in args and "/workspace" in args
    assert "--json" in args

    # Only the designated workspace should be bind-mounted.
    volume_args = [
        args[i + 1]
        for i, value in enumerate(args[:-1])
        if value == "-v"
    ]

    assert len(volume_args) == 1
    assert volume_args[0].endswith(":/workspace:rw")


def test_prepare_workspaces(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "f" * 32

    run_ws, adj_ws = orchestrator.prepare_workspaces(run_id)

    assert run_ws.exists() and run_ws.is_dir()
    assert adj_ws.exists() and adj_ws.is_dir()

    secret = adj_ws / "protected_secret.txt"
    assert secret.exists()
    assert "CONFIDENTIAL" in secret.read_text()


def test_docker_available_check_false():
    with patch(
        "subprocess.run",
        side_effect=FileNotFoundError("docker not found"),
    ):
        ok, msg = DockerSandboxOrchestrator.is_docker_available()

        assert not ok
        assert "not found" in msg


def test_docker_available_check_true():
    mock_res = MagicMock(
        returncode=0,
        stdout="Server Version: 24.0.0\n",
        stderr="",
    )

    with patch("subprocess.run", return_value=mock_res):
        ok, msg = DockerSandboxOrchestrator.is_docker_available()
        assert ok


def test_execute_and_submit_container_mode(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "1" * 32

    sample_checks = [
        {
            "check_id": "docker-socket-absence",
            "policy_id": "no-docker-socket",
            "policy_version": "1.0.0",
            "status": "PASS",
            "expected": "docker socket absent",
            "observed": "docker socket absent",
            "evidence_ref": "probe:docker-socket",
        }
    ]

    with patch.object(
        orchestrator,
        "is_docker_available",
        return_value=(True, "ok"),
    ), patch.object(
        orchestrator,
        "run_in_docker",
        return_value={"checks": sample_checks},
    ), patch.object(
        orchestrator.submitter,
        "submit_all",
        return_value=[
            {"check_id": "docker-socket-absence", "status": "created"}
        ],
    ):
        res = orchestrator.execute_and_submit(
            run_id=run_id,
            worker_id="worker-test",
        )

        assert res["mode"] == "container"
        assert res["docker_available"] is True
        assert len(res["submissions"]) == 1
        assert res["submissions"][0]["status"] == "created"


def test_execute_and_submit_container_error_submits_error_checks(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "2" * 32

    captured = []

    def fake_submit_all(subs):
        captured.extend(subs)
        return [
            {"check_id": s.check_id, "status": "created"}
            for s in subs
        ]

    with patch.object(
        orchestrator,
        "is_docker_available",
        return_value=(True, "ok"),
    ), patch.object(
        orchestrator,
        "run_in_docker",
        side_effect=RuntimeError(
            "Container process exited with code 137"
        ),
    ), patch.object(
        orchestrator.submitter,
        "submit_all",
        side_effect=fake_submit_all,
    ):
        res = orchestrator.execute_and_submit(
            run_id=run_id,
            worker_id="worker-test",
        )

        assert res["mode"] == "container"
        assert "Container process exited with code 137" in res["docker_error"]
        assert len(captured) == 7

        for sub in captured:
            assert sub.error is not None
            assert "Container execution error" in sub.error
            # Ensure no successful pass is fabricated.
            assert sub.observed is None


def test_execute_and_submit_host_fallback_never_fabricates_pass(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "3" * 32

    captured = []

    def fake_submit_all(subs):
        captured.extend(subs)
        return [
            {"check_id": s.check_id, "status": "created"}
            for s in subs
        ]

    with patch.object(
        orchestrator,
        "is_docker_available",
        return_value=(False, "daemon unresponsive"),
    ), patch.object(
        orchestrator.submitter,
        "submit_all",
        side_effect=fake_submit_all,
    ):
        res = orchestrator.execute_and_submit(
            run_id=run_id,
            worker_id="worker-test",
            allow_fallback=True,
        )

        assert res["mode"] == "host_fallback"
        assert res["docker_available"] is False
        assert len(captured) == 7

        for sub in captured:
            # Host fallback must not claim successful container isolation.
            if sub.reported_state == "COMPLETED":
                assert sub.observed != sub.expected
            else:
                assert sub.reported_state == "UNAVAILABLE"
                assert sub.limitation is not None
                assert len(sub.limitation) > 0


def test_execute_and_submit_disallow_fallback_raises(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "4" * 32

    with patch.object(
        orchestrator,
        "is_docker_available",
        return_value=(False, "daemon not found"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Docker is not available",
        ):
            orchestrator.execute_and_submit(
                run_id=run_id,
                allow_fallback=False,
            )


def test_run_in_docker_valid_isolated_mount(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "5" * 32

    container_report = {
        "checks": [
            {
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": "INCONCLUSIVE",
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "adjacent workspace isolation could not be verified",
                "evidence_ref": "probe:workspace-isolation",
                "evidence_detail": (
                    "Designated workspace /workspace verified writable and read-back intact. "
                    "No existing adjacent workspace paths were available inside container "
                    "to probe; isolation is not verified from container alone."
                ),
                "limitation": "No accessible adjacent workspace path was available for a meaningful isolation probe.",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(run_id=run_id)

    ws_check = report["checks"][0]
    assert ws_check["status"] == "PASS"
    assert ws_check["observed"] == ws_check["expected"]
    assert ws_check["evidence_ref"] == "host-container-dual-verification:workspace-isolation"
    assert "Host verified single isolated bind-mount" in ws_check["evidence_detail"]
    assert "Container verified designated workspace writable" in ws_check["evidence_detail"]
    assert ws_check["limitation"] is None
    assert ws_check["error"] is None


def test_run_in_docker_unexpected_extra_bind_mount(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "6" * 32

    container_report = {
        "checks": [
            {
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": "INCONCLUSIVE",
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "adjacent workspace isolation could not be verified",
                "evidence_ref": "probe:workspace-isolation",
                "evidence_detail": "Designated workspace /workspace verified writable and read-back intact.",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    original_build_args = orchestrator.build_docker_run_args

    def fake_build_args(*args, **kwargs):
        cmd = original_build_args(*args, **kwargs)
        cmd.extend(["-v", f"{tmp_path}/rogue:/rogue:ro"])
        return cmd

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch.object(orchestrator, "build_docker_run_args", side_effect=fake_build_args), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(run_id=run_id)

    ws_check = report["checks"][0]
    assert ws_check["status"] == "INCONCLUSIVE"
    assert "Unexpected extra bind mount" in ws_check["limitation"]
    assert ws_check["evidence_ref"] == "host:mount-isolation-failed"


def test_run_in_docker_missing_adjacent_sentinel(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "7" * 32

    run_ws, adj_ws = orchestrator.prepare_workspaces(run_id)
    sentinel = adj_ws / "protected_secret.txt"
    sentinel.unlink()

    container_report = {
        "checks": [
            {
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": "INCONCLUSIVE",
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "adjacent workspace isolation could not be verified",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(
            run_id=run_id,
            run_workspace=run_ws,
            adjacent_workspace=adj_ws,
        )

    ws_check = report["checks"][0]
    assert ws_check["status"] == "INCONCLUSIVE"
    assert "protected_secret.txt" in ws_check["limitation"]


def test_run_in_docker_missing_container_workspace_check(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "8" * 32

    container_report = {
        "checks": [
            {
                "check_id": "docker-socket-absence",
                "policy_id": "no-docker-socket",
                "policy_version": "1.0.0",
                "status": "PASS",
                "expected": "docker socket absent",
                "observed": "docker socket absent",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(run_id=run_id)

    ws_check = next(c for c in report["checks"] if c["check_id"] == "workspace-isolation")
    assert ws_check["status"] == "INCONCLUSIVE"
    assert "missing" in ws_check["limitation"].lower()


def test_run_in_docker_invalid_container_workspace_verification(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "9" * 32

    container_report = {
        "checks": [
            {
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": "ERROR",
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "workspace unwritable",
                "error": "Permission denied: /workspace",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(run_id=run_id)

    ws_check = report["checks"][0]
    assert ws_check["status"] == "ERROR"
    assert ws_check["observed"] == "workspace unwritable"
    assert ws_check["status"] != "PASS"


def test_run_in_docker_actual_cross_workspace_breach(tmp_path):
    orchestrator = DockerSandboxOrchestrator(
        workspaces_base_dir=str(tmp_path),
    )
    run_id = "run_" + "a" * 32

    container_report = {
        "checks": [
            {
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": "FAIL",
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "cross-workspace isolation breach: read protected file at /adjacent/protected_secret.txt",
                "evidence_ref": "probe:workspace-isolation",
                "evidence_detail": "Probed 1 adjacent paths. Breaches: ['read protected file']",
            }
        ]
    }

    mock_proc = MagicMock(returncode=0, stdout=json.dumps(container_report), stderr="")

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch("subprocess.run", return_value=mock_proc):
        report = orchestrator.run_in_docker(run_id=run_id)

    ws_check = report["checks"][0]
    assert ws_check["status"] == "FAIL"
    assert "cross-workspace isolation breach" in ws_check["observed"]


def test_verify_host_mount_isolation_direct_checks(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
    run_id = "run_" + "b" * 32
    run_ws, adj_ws = orchestrator.prepare_workspaces(run_id)

    # 1. Valid command
    cmd = orchestrator.build_docker_run_args(run_id, run_ws)
    ok, err, ev = orchestrator.verify_host_mount_isolation(cmd, run_ws, adj_ws)
    assert ok is True
    assert err is None
    assert ev["run_workspace"] == str(run_ws.resolve())

    # 2. Mount source resolves to adjacent workspace
    bad_cmd = orchestrator.build_docker_run_args(run_id, adj_ws)
    ok, err, _ = orchestrator.verify_host_mount_isolation(bad_cmd, run_ws, adj_ws)
    assert ok is False
    assert "does not match current run workspace" in err

    # 3. Mount target is not /workspace:rw
    bad_target_cmd = ["docker", "run", "-v", f"{run_ws.resolve()}:/workspace:ro"]
    ok, err, _ = orchestrator.verify_host_mount_isolation(bad_target_cmd, run_ws, adj_ws)
    assert ok is False
    assert "Mount container target must be exactly '/workspace:rw'" in err

    # 4. Same path for run and adjacent workspace
    ok, err, _ = orchestrator.verify_host_mount_isolation(cmd, run_ws, run_ws)
    assert ok is False
    assert "exact same path" in err

    # 5. Non-existent run workspace
    missing_ws = tmp_path / "does_not_exist"
    ok, err, _ = orchestrator.verify_host_mount_isolation(cmd, missing_ws, adj_ws)
    assert ok is False
    assert "does not exist" in err
