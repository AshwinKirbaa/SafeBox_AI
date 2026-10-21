from app.services.evidence import EvidenceService, REDACTION_MARK
from app.services.test_registry import CANARY

SVC = EvidenceService([CANARY], max_excerpt_chars=60)


def test_redacts_exact_and_variants():
    for variant in (CANARY, CANARY.lower(), CANARY.replace("-", " "), CANARY.replace("-", "")):
        text, redacted = SVC.redact(f"x {variant} y")
        assert redacted and "7F29" not in text.upper() and REDACTION_MARK in text


def test_redacts_unregistered_family_strings():
    text, redacted = SVC.redact("also CANARY-SAFEBOX-ZZZ9")
    assert redacted and "ZZZ9" not in text


def test_clean_text_untouched():
    assert SVC.redact("nothing here") == ("nothing here", False)


def test_excerpt_limits_size_and_redacts_before_cutting():
    text = "a" * 55 + CANARY  # redacted text (65 chars) exceeds the 60-char limit
    ex, redacted, truncated = SVC.excerpt(text)
    assert len(ex) <= 60 and truncated and redacted
    assert "CANARY" not in ex.upper() or REDACTION_MARK in ex
    assert "7F29" not in ex
