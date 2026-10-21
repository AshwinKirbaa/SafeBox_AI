from datetime import datetime, timezone, timedelta

import pytest
from pydantic import ValidationError

from app.schemas import (EvaluationResult, InfraCheckSubmission, RunOptions, RunRequest,
                         TargetConfig, TestStatus)

NOW = datetime(2026, 1, 2, 3, 4, 5, 678000, tzinfo=timezone.utc)
RUN_ID = "run_" + "a" * 32


def _result(**kw):
    base = dict(test_id="t", test_version="1", rule_id="r", rule_version="1", status="PASS",
                explanation="x", evidence_refs=[], started_at=NOW, completed_at=NOW,
                matched_indicators=[], limitations=[])
    return EvaluationResult(**{**base, **kw})


def test_statuses_are_exactly_five():
    assert {s.value for s in TestStatus} == {"PASS", "FAIL", "ERROR", "INCONCLUSIVE", "UNSUPPORTED"}


@pytest.mark.parametrize("bad", ["PASSED", "pass", "OK", "", None])
def test_incorrect_status_rejected(bad):
    with pytest.raises(ValidationError):
        _result(status=bad)


def test_naive_timestamp_rejected():
    with pytest.raises(ValidationError):
        _result(started_at=datetime(2026, 1, 1))


def test_timestamps_normalised_and_serialised_utc():
    ist = timezone(timedelta(hours=5, minutes=30))
    r = _result(started_at=NOW.astimezone(ist))
    assert r.model_dump(mode="json")["started_at"] == "2026-01-02T03:04:05.678Z"


def test_json_serialisation_is_stable():
    assert _result().model_dump_json() == _result().model_dump_json()


def test_run_request_rejects_unknown_fields_and_urls():
    with pytest.raises(ValidationError):
        RunRequest(test_id="canary-disclosure", target={"mode": "mock", "url": "http://x"})
    with pytest.raises(ValidationError):
        RunRequest(test_id="canary-disclosure", command="rm -rf /")


@pytest.mark.parametrize("tid", ["", "A", "has space", "../etc", "x;y", "a" * 80])
def test_malformed_test_id_rejected(tid):
    with pytest.raises(ValidationError):
        RunRequest(test_id=tid)


@pytest.mark.parametrize("n", [0, 1, 11, 1000])
def test_repeat_count_bounds(n):
    with pytest.raises(ValidationError):
        RunOptions(repeat_count=n)


def test_invalid_target_mode_and_combos():
    with pytest.raises(ValidationError):
        TargetConfig(mode="docker")
    with pytest.raises(ValidationError):
        TargetConfig(mode="ollama", mock_behavior="vulnerable")
    with pytest.raises(ValidationError):
        TargetConfig(mode="mock", model="llama3")
    with pytest.raises(ValidationError):
        TargetConfig(mode="ollama", model="bad name; rm")


def _infra(**kw):
    base = dict(worker_id="w1", run_id=RUN_ID, check_id="net-egress", policy_id="pol",
                policy_version="1", observed="blocked", expected="blocked", timestamp=NOW)
    return InfraCheckSubmission(**{**base, **kw})


def test_infra_submission_requires_outcomes_when_completed():
    with pytest.raises(ValidationError):
        _infra(observed=None)
    with pytest.raises(ValidationError):
        _infra(reported_state="UNAVAILABLE", observed=None, expected=None)
    assert _infra(reported_state="PENDING", observed=None, expected=None)
    assert _infra(observed=None, expected=None, error="worker crashed")


def test_infra_submission_rejects_bad_run_id():
    with pytest.raises(ValidationError):
        _infra(run_id="run_1; DROP TABLE runs")
