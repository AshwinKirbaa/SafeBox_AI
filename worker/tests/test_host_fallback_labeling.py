"""Host-fallback results are diagnostics of the host, never proof of container isolation."""
import sys

from worker.models import InfraCheckSubmission
from worker.orchestrator import docker_runner as dr
from worker.orchestrator.docker_runner import DockerSandboxOrchestrator

NOW = "2026-10-22T00:00:00.000Z"


def _sub(check_id, observed, expected):
    return InfraCheckSubmission(
        worker_id="w", run_id="run_" + "a" * 32, check_id=check_id, policy_id="p",
        policy_version="1", reported_state="COMPLETED", observed=observed, expected=expected,
        timestamp=NOW)


def _orchestrator(monkeypatch, subs):
    sent = []
    monkeypatch.setattr(DockerSandboxOrchestrator, "is_docker_available",
                        classmethod(lambda cls: (False, "daemon offline")))
    import worker.runner as runner_mod
    monkeypatch.setattr(runner_mod.IsolationCheckRunner, "run_and_prepare_submissions",
                        lambda self, worker_id, run_id, ctx: ([], subs))

    class Sub:
        def submit_all(self, items):
            sent.extend(items)
            return [{"status": "created", "check_id": i.check_id} for i in items]

    return DockerSandboxOrchestrator(submitter=Sub(), workspaces_base_dir=None), sent


def test_host_fallback_pass_becomes_unavailable_and_failure_is_labelled_host(monkeypatch, tmp_path):
    subs = [_sub("network-egress", "blocked", "blocked"), _sub("non-root-execution", "uid=0", "uid=10001")]
    orch, sent = _orchestrator(monkeypatch, subs)
    orch.workspaces_base_dir = tmp_path
    res = orch.execute_and_submit("run_" + "a" * 32, allow_fallback=True)
    assert res["mode"] == "host_fallback"
    by_id = {s.check_id: s for s in sent}
    assert by_id["network-egress"].reported_state == "UNAVAILABLE"
    assert by_id["network-egress"].observed is None
    # A host-side mismatch stays a failure signal, but must say it was measured on the host.
    assert by_id["non-root-execution"].reported_state == "COMPLETED"
    assert "host" in (by_id["non-root-execution"].limitation or "").lower()
    assert "not" in by_id["non-root-execution"].limitation.lower()


def test_cli_does_not_report_duplicate_submissions_as_success(monkeypatch, capsys):
    monkeypatch.setattr(DockerSandboxOrchestrator, "execute_and_submit",
                        lambda self, **kw: {"mode": "container", "docker_available": True,
                                            "submissions": [{"status": "duplicate", "check_id": "x"}]})
    monkeypatch.setattr(sys, "argv", ["docker_runner", "--run-id", "run_" + "a" * 32])
    assert dr.main() != 0
    assert "already" in capsys.readouterr().err.lower()
