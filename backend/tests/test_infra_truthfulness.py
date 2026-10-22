"""Aggregate infrastructure PASS must be backed by all seven required checks."""
from tests.test_api import infra_body
from tests.conftest import run

REQUIRED = [
    "docker-socket-absence", "non-root-execution", "dropped-capabilities", "resource-limits",
    "workspace-isolation", "host-filesystem-protection", "network-egress",
]


def _post(client, rid, check_id):
    r = client.post(f"/api/security-tests/runs/{rid}/infrastructure-checks",
                    json=infra_body(rid, check_id=check_id))
    assert r.status_code == 201 and r.json()["status"] == "PASS"


def _infra(client, rid):
    return client.get(f"/api/security-tests/runs/{rid}").json()["infrastructure"]


def test_partial_passing_checks_do_not_aggregate_to_pass(client):
    rid = run(client).json()["run_id"]
    for cid in REQUIRED[:6]:
        _post(client, rid, cid)
    infra = _infra(client, rid)
    assert infra["status"] != "PASS"
    assert "network-egress" in infra["note"] and "6 of 7" in infra["note"]
    assert all(c["status"] == "PASS" for c in infra["checks"])  # per-check results stay truthful


def test_unrecognised_check_ids_cannot_satisfy_required_set(client):
    rid = run(client).json()["run_id"]
    for cid in ["a", "b", "c", "d", "e", "f", "g"]:
        _post(client, rid, cid)
    assert _infra(client, rid)["status"] != "PASS"


def test_all_seven_required_checks_aggregate_to_pass(client):
    rid = run(client).json()["run_id"]
    for cid in REQUIRED:
        _post(client, rid, cid)
    assert _infra(client, rid)["status"] == "PASS"
