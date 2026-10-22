"""Tests for DockerSandboxOrchestrator."""

from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from worker.orchestrator.docker_runner import DockerSandboxOrchestrator


def test_build_docker_run_args():
    orchestrator = DockerSandboxOrchestrator(image_tag="safebox-worker:v1")
    run_id = "run_" + "e" * 32
    ws_path = Path("/tmp/test_workspace")

    args = orchestrator.build_docker_run_args(run_id, ws_path, worker_id="worker-test")

    # Verify key hardening flags
    assert "--user" in args and "10001:10001" in args
    assert "--security-opt=no-new-privileges:true" in args
    assert "--cap-drop=ALL" in args
    assert "--read-only" in args
    assert "--tmpfs" in args and "/tmp:rw,noexec,nosuid,size=64m" in args
    assert "--memory=256m" in args
    assert "--pids-limit=64" in args
    assert "--network=none" in args
    assert "--run-id" in args and run_id in args
    assert "--worker-id" in args and "worker-test" in args
    assert "--json" in args


def test_prepare_workspaces(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
    run_id = "run_" + "f" * 32
    run_ws, adj_ws = orchestrator.prepare_workspaces(run_id)

    assert run_ws.exists() and run_ws.is_dir()
    assert adj_ws.exists() and adj_ws.is_dir()
    secret = adj_ws / "protected_secret.txt"
    assert secret.exists()
    assert "CONFIDENTIAL" in secret.read_text()


def test_docker_available_check_false():
    with patch("subprocess.run", side_effect=FileNotFoundError("docker not found")):
        ok, msg = DockerSandboxOrchestrator.is_docker_available()
        assert not ok
        assert "not found" in msg


def test_docker_available_check_true():
    mock_res = MagicMock(returncode=0, stdout="Server Version: 24.0.0\n", stderr="")
    with patch("subprocess.run", return_value=mock_res):
        ok, msg = DockerSandboxOrchestrator.is_docker_available()
        assert ok


def test_execute_and_submit_container_mode(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
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

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch.object(orchestrator, "run_in_docker", return_value={"checks": sample_checks}), \
         patch.object(orchestrator.submitter, "submit_all", return_value=[{"check_id": "docker-socket-absence", "status": "created"}]):
        res = orchestrator.execute_and_submit(run_id=run_id, worker_id="worker-test")
        assert res["mode"] == "container"
        assert res["docker_available"] is True
        assert len(res["submissions"]) == 1
        assert res["submissions"][0]["status"] == "created"


def test_execute_and_submit_container_error_submits_error_checks(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
    run_id = "run_" + "2" * 32

    captured = []
    def fake_submit_all(subs):
        captured.extend(subs)
        return [{"check_id": s.check_id, "status": "created"} for s in subs]

    with patch.object(orchestrator, "is_docker_available", return_value=(True, "ok")), \
         patch.object(orchestrator, "run_in_docker", side_effect=RuntimeError("Container process exited with code 137")), \
         patch.object(orchestrator.submitter, "submit_all", side_effect=fake_submit_all):
        res = orchestrator.execute_and_submit(run_id=run_id, worker_id="worker-test")
        assert res["mode"] == "container"
        assert "Container process exited with code 137" in res["docker_error"]
        assert len(captured) == 7
        for sub in captured:
            assert sub.error is not None
            assert "Container execution error" in sub.error
            # Ensure no successful pass is fabricated
            assert sub.observed is None


def test_execute_and_submit_host_fallback_never_fabricates_pass(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
    run_id = "run_" + "3" * 32

    captured = []
    def fake_submit_all(subs):
        captured.extend(subs)
        return [{"check_id": s.check_id, "status": "created"} for s in subs]

    with patch.object(orchestrator, "is_docker_available", return_value=(False, "daemon unresponsive")), \
         patch.object(orchestrator.submitter, "submit_all", side_effect=fake_submit_all):
        res = orchestrator.execute_and_submit(run_id=run_id, worker_id="worker-test", allow_fallback=True)
        assert res["mode"] == "host_fallback"
        assert res["docker_available"] is False
        assert len(captured) == 7
        for sub in captured:
            # Under host fallback, no check must be reported as passing container isolation
            if sub.reported_state == "COMPLETED":
                assert sub.observed != sub.expected  # only actual failures can be COMPLETED
            else:
                assert sub.reported_state == "UNAVAILABLE"
                assert sub.limitation is not None and len(sub.limitation) > 0


def test_execute_and_submit_disallow_fallback_raises(tmp_path):
    orchestrator = DockerSandboxOrchestrator(workspaces_base_dir=str(tmp_path))
    run_id = "run_" + "4" * 32
    with patch.object(orchestrator, "is_docker_available", return_value=(False, "daemon not found")):
        with pytest.raises(RuntimeError, match="Docker is not available"):
            orchestrator.execute_and_submit(run_id=run_id, allow_fallback=False)


def test_main_cli_returns_nonzero_on_failed_submissions():
    from worker.orchestrator.docker_runner import main
    mock_res = {
        "mode": "container",
        "docker_available": True,
        "submissions": [
            {"check_id": "docker-socket-absence", "status": "failed", "error": "401 Unauthorized"},
            {"check_id": "non-root-execution", "status": "failed", "error": "401 Unauthorized"},
        ],
    }

    test_args = ["docker_runner.py", "--run-id", "run_" + "5" * 32, "--token", "bad-token"]
    with patch("sys.argv", test_args), \
         patch.object(DockerSandboxOrchestrator, "execute_and_submit", return_value=mock_res):
        exit_code = main()
        assert exit_code == 1


def test_main_cli_returns_zero_on_successful_submissions():
    from worker.orchestrator.docker_runner import main
    mock_res = {
        "mode": "container",
        "docker_available": True,
        "submissions": [
            {"check_id": "docker-socket-absence", "status": "created"},
            {"check_id": "non-root-execution", "status": "created"},
        ],
    }

    test_args = ["docker_runner.py", "--run-id", "run_" + "6" * 32, "--token", "good-token"]
    with patch("sys.argv", test_args), \
         patch.object(DockerSandboxOrchestrator, "execute_and_submit", return_value=mock_res):
        exit_code = main()
        assert exit_code == 0


def test_token_with_special_characters_forwarded_to_submitter():
    special_token = "A+B/C==D E_F!@#$"
    orchestrator = DockerSandboxOrchestrator(worker_token=special_token)
    assert orchestrator.submitter.token == special_token
    headers = orchestrator.submitter._headers()
    assert headers["X-Worker-Token"] == special_token


def test_find_env_token_from_env_file(tmp_path, monkeypatch):
    from worker.config import find_env_token
    monkeypatch.delenv("SAFEBOX_WORKER_TOKEN", raising=False)

    fake_env = tmp_path / "backend" / ".env"
    fake_env.parent.mkdir(parents=True, exist_ok=True)
    fake_env.write_text("SAFEBOX_WORKER_TOKEN=SecretToken123+==\n", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    found = find_env_token()
    assert found == "SecretToken123+=="


