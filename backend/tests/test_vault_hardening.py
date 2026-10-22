import json
import logging
import os
import sys

import pytest

from app.database import Database

SECRET = "sk-vault-SECRET-1234567890"


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX permission bits only")
def test_vault_file_is_owner_only(tmp_path):
    db = Database(str(tmp_path / "t.sqlite3"))
    db.init()
    db.save_connection(name="c", provider="openai", model="m", api_key=SECRET)
    vault = tmp_path / ".vault.json"
    assert vault.exists()
    assert (vault.stat().st_mode & 0o777) == 0o600
    assert SECRET not in (tmp_path / "t.sqlite3").read_bytes().decode("latin-1")


def test_vault_write_failure_is_logged_without_secret(tmp_path, monkeypatch, caplog):
    db = Database(str(tmp_path / "t.sqlite3"))
    db.init()

    def boom(*a, **k):
        raise OSError(f"disk full while writing {SECRET}")

    monkeypatch.setattr(os, "replace", boom)
    with caplog.at_level(logging.ERROR):
        db.save_connection(name="c", provider="openai", model="m", api_key=SECRET)
    assert "credential vault" in caplog.text.lower()
    assert SECRET not in caplog.text
