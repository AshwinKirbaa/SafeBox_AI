import logging

import pytest

from app.config import Settings
from app.database import Database
from app.schemas import (InfraStatus, MockBehavior, RunRequest, RunState, TargetMode,
                         TestStatus as S)
from app.services.evidence import EvidenceService
from app.services.mock_adapter import MockAdapter
from app.services.runner import (InvalidRunOptions, SecurityTestRunner, TargetModeNotPermitted,
                                 UnknownTestError)
from app.services.test_registry import CANARY, TestRegistry


@pytest.fixture
def parts(tmp_path):
    settings = Settings(_env_file=None, database_path=str(tmp_path / "r.db"), max_response_chars=300)
    reg, db = TestRegistry(), Database(settings.database_path)
    db.init()
    ev = EvidenceService(reg.sensitive_values(), 200)
    return settings, reg, db, ev


@pytest.fixture
def runner(parts):
    return SecurityTestRunner(*parts)


def req(test="canary-disclosure", behavior="defended", **kw):
    return RunRequest(test_id=test, target={"mode": "mock", "mock_behavior": behavior}, **kw)


def test_vulnerable_target_fails(runner):
    rec = runner.run(req(behavior="vulnerable"))
    assert rec.state is RunState.COMPLETED and rec.result.status is S.FAIL
    assert rec.result.rule_id == "canary-exact-match" and rec.result.test_version == "1.0.0"
    assert "canary_exact_match" in rec.result.matched_indicators


def test_defended_target_passes(runner):
    assert runner.run(req(behavior="defended")).result.status is S.PASS


def test_ambiguous_target_is_inconclusive(runner):
    assert runner.run(req(behavior="ambiguous")).result.status is S.INCONCLUSIVE


def test_connection_failure_is_error(runner):
    rec = runner.run(req(behavior="error"))
    assert rec.result.status is S.ERROR
    assert any(e.kind == "target_error" for e in rec.evidence)


def test_timeout_is_error(runner):
    rec = runner.run(req(behavior="timeout"))
    assert rec.result.status is S.ERROR and "timeout" in rec.result.explanation


def test_oversized_response_enforced_and_inconclusive(runner):
    rec = runner.run(req(behavior="oversized"))
    assert rec.result.status is S.INCONCLUSIVE
    out = [e for e in rec.evidence if e.kind == "model_output"][0]
    assert out.truncated and out.size_chars <= 200


@pytest.mark.parametrize("test,vuln,safe", [
    ("instruction-conflict", S.FAIL, S.PASS), ("prohibited-string", S.FAIL, S.PASS)])
def test_other_rules_end_to_end(runner, test, vuln, safe):
    assert runner.run(req(test, "vulnerable")).result.status is vuln
    assert runner.run(req(test, "defended")).result.status is safe


def test_unknown_test_rejected(runner):
    with pytest.raises(UnknownTestError):
        runner.run(req("does-not-exist"))


def test_ollama_mode_not_permitted_when_server_is_mock(runner):
    with pytest.raises(TargetModeNotPermitted):
        runner.run(RunRequest(test_id="canary-disclosure", target={"mode": "ollama"}))


def test_ollama_connection_failure_gives_error_not_pass(tmp_path):
    # Real OllamaAdapter pointed at a closed loopback port; nothing is mocked.
    settings = Settings(_env_file=None, database_path=str(tmp_path / "o.db"), target_mode="ollama",
                        ollama_base_url="http://127.0.0.1:9", inference_timeout_seconds=2)
    reg, db = TestRegistry(), Database(settings.database_path)
    db.init()
    r = SecurityTestRunner(settings, reg, db, EvidenceService(reg.sensitive_values()))
    rec = r.run(RunRequest(test_id="canary-disclosure"))
    assert rec.target.mode is TargetMode.ollama and rec.result.status is S.ERROR


def test_repeatability_uses_real_executions(parts):
    adapters = []

    def factory(settings, target):
        a = MockAdapter(target.mock_behavior, settings.max_response_chars)
        adapters.append(a)
        return a

    runner = SecurityTestRunner(*parts, adapter_factory=factory)
    rec = runner.run(req("repeatability", "flaky", options={"repeat_count": 4}))
    assert adapters[0].calls == 4
    rep = rec.result.repeatability
    assert [o.status for o in rep.outcomes] == [S.FAIL, S.PASS, S.FAIL, S.PASS]
    assert not rep.agree and rep.agreement_rate == 0.5 and rec.result.status is S.FAIL
    assert len([e for e in rec.evidence if e.kind == "model_output"]) == 4


def test_repeatability_consistent_defended_passes(runner):
    rec = runner.run(req("repeatability", "defended", options={"repeat_count": 3}))
    assert rec.result.status is S.PASS and rec.result.repeatability.agree


def test_repeatability_with_errors_is_error(runner):
    assert runner.run(req("repeatability", "error")).result.status is S.ERROR


def test_repeatability_invalid_base_test(runner):
    with pytest.raises(InvalidRunOptions):
        runner.run(req("repeatability", options={"repeat_base_test": "repeatability"}))
    with pytest.raises(InvalidRunOptions):
        runner.run(req("repeatability", options={"repeat_base_test": "nope"}))


def test_prompt_length_limit_gives_error(parts):
    settings = Settings(_env_file=None, database_path=parts[0].database_path, max_prompt_length=100)
    r = SecurityTestRunner(settings, *parts[1:])
    assert r.run(req()).result.status is S.ERROR


def test_run_is_persisted_and_retrievable(runner, parts):
    rec = runner.run(req(behavior="vulnerable"))
    again = runner.get_run(rec.run_id)
    assert again.model_dump_json() == rec.model_dump_json()
    items, total = parts[2].list_runs(10, 0)
    assert total == 1 and items[0].run_id == rec.run_id and items[0].status is S.FAIL
    assert runner.get_run("run_" + "0" * 32) is None


def test_export_is_redacted_but_raw_is_kept_separately(runner, parts):
    rec = runner.run(req(behavior="vulnerable"))
    assert CANARY not in rec.model_dump_json()
    assert any(e.redacted for e in rec.evidence)
    raw = parts[2].get_raw(rec.run_id)
    assert CANARY in raw.executions[0].output_text  # fictional canary kept in raw store only


def test_infrastructure_is_missing_not_pass_when_absent(runner):
    rec = runner.run(req(behavior="defended"))
    assert rec.result.status is S.PASS
    assert rec.infrastructure.status is InfraStatus.MISSING and rec.infrastructure.checks == []


def test_logs_do_not_contain_outputs_or_canary(runner, caplog):
    with caplog.at_level(logging.DEBUG):
        runner.run(req(behavior="vulnerable"))
    assert CANARY not in caplog.text and "internal code" not in caplog.text


def test_unexpected_exception_aborts_with_error_never_pass(parts):
    class Boom(MockAdapter):
        def generate(self, request):
            raise RuntimeError("bug")

    r = SecurityTestRunner(*parts, adapter_factory=lambda s, t: Boom(MockBehavior.defended))
    rec = r.run(req())
    assert rec.state is RunState.ABORTED and rec.result.status is S.ERROR
