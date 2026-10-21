import pytest

from app.schemas import MockBehavior as B
from app.services.mock_adapter import MockAdapter
from app.services.model_adapter import (TargetConnectionError, TargetRequest, TargetTimeout,
                                        clamp_output)
from app.services.test_registry import CANARY, TestRegistry

CASE_IN = TestRegistry().get("canary-disclosure").build_input()
REQ = TargetRequest(CASE_IN.system_prompt, CASE_IN.user_prompt)


def test_vulnerable_returns_canary():
    assert CANARY in MockAdapter(B.vulnerable).generate(REQ).text


def test_defended_refuses():
    text = MockAdapter(B.defended).generate(REQ).text
    assert CANARY not in text and "can't" in text


def test_deterministic():
    assert MockAdapter(B.vulnerable).generate(REQ).text == MockAdapter(B.vulnerable).generate(REQ).text


def test_error_and_timeout_simulation():
    with pytest.raises(TargetConnectionError):
        MockAdapter(B.error).generate(REQ)
    with pytest.raises(TargetTimeout):
        MockAdapter(B.timeout).generate(REQ)


def test_flaky_alternates_and_counts_calls():
    a = MockAdapter(B.flaky)
    outs = [CANARY in a.generate(REQ).text for _ in range(4)]
    assert outs == [True, False, True, False] and a.calls == 4


def test_oversized_output_is_clamped_and_flagged():
    r = MockAdapter(B.oversized, max_response_chars=100).generate(REQ)
    assert len(r.text) == 100 and r.truncated


def test_clamp_output():
    assert clamp_output("abc", 5) == ("abc", False)
    assert clamp_output("abcdef", 5) == ("abcde", True)


def test_new_cases_mock_behavior():
    reg = TestRegistry()
    from app.services.test_registry import INDIRECT_INJECTION_MARKER, SYSTEM_DIRECTIVE_SECRET

    # Indirect injection
    inj_in = reg.get("indirect-injection").build_input()
    inj_req = TargetRequest(inj_in.system_prompt, inj_in.user_prompt)
    assert INDIRECT_INJECTION_MARKER in MockAdapter(B.vulnerable).generate(inj_req).text
    assert INDIRECT_INJECTION_MARKER not in MockAdapter(B.defended).generate(inj_req).text

    # System prompt extraction
    sys_in = reg.get("system-prompt-extraction").build_input()
    sys_req = TargetRequest(sys_in.system_prompt, sys_in.user_prompt)
    assert SYSTEM_DIRECTIVE_SECRET in MockAdapter(B.vulnerable).generate(sys_req).text
    assert SYSTEM_DIRECTIVE_SECRET not in MockAdapter(B.defended).generate(sys_req).text

    # Benign control
    ben_in = reg.get("benign-control").build_input()
    ben_req = TargetRequest(ben_in.system_prompt, ben_in.user_prompt)
    assert "sandbox" in MockAdapter(B.vulnerable).generate(ben_req).text.lower()
    assert "sandbox" in MockAdapter(B.defended).generate(ben_req).text.lower()
