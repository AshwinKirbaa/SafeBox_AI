"""Check that outbound network access is strictly blocked under egress-deny policy.

Distinguishes proven network isolation (e.g. interface restricted to loopback only,
ENETUNREACH on raw IP connects) from unrelated failures (such as DNS resolution errors).
"""

import errno
import socket
from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


# Direct IP targets to test raw egress without relying on DNS resolution
PROBE_TARGETS = [
    ("1.1.1.1", 80),        # Public DNS/HTTP
    ("8.8.8.8", 53),        # Public DNS
    ("10.255.255.1", 80),   # RFC1918 unreachable route
]


class NetworkEgressCheck(BaseIsolationCheck):
    check_id = "network-egress"
    policy_id = "egress-deny-all"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "outbound network connections blocked at socket/interface layer"

        # 1. Inspect network interfaces
        interfaces: list[str] = []
        try:
            if hasattr(socket, "if_nameindex"):
                interfaces = [name for _, name in socket.if_nameindex()]
            elif Path("/proc/net/dev").exists():
                lines = Path("/proc/net/dev").read_text().splitlines()[2:]
                interfaces = [line.split(":")[0].strip() for line in lines if ":" in line]
        except Exception:
            pass

        # 2. Probe direct IP egress via TCP socket
        connect_results = []
        leaks = []
        all_unreachable = True
        had_dns_only_error = False

        for host, port in PROBE_TARGETS:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2.0)
            try:
                s.connect((host, port))
                # If we get here, connection succeeded -> LEAK!
                leaks.append(f"{host}:{port} connected successfully")
                all_unreachable = False
            except socket.timeout:
                connect_results.append((host, port, "timeout"))
                all_unreachable = False  # Timeout alone does not prove route isolation
            except OSError as e:
                err_code = e.errno or getattr(e, "winerror", None)
                err_msg = str(e)
                # Network is unreachable or Cannot assign requested address
                if err_code in (errno.ENETUNREACH, 10051, errno.EADDRNOTAVAIL, 10049):
                    connect_results.append((host, port, f"unreachable ({err_code})"))
                elif err_code in (errno.ECONNREFUSED, 10061):
                    connect_results.append((host, port, f"conn_refused ({err_code})"))
                    all_unreachable = False
                else:
                    connect_results.append((host, port, f"error {err_code}: {err_msg}"))
                    all_unreachable = False
            finally:
                s.close()

        # Evaluate outcomes:
        # 1. Leak detected:
        if leaks:
            obs = f"outbound egress permitted: {'; '.join(leaks)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:network-egress",
                evidence_detail=f"Interfaces: {interfaces}. Connect results: {connect_results}",
            )

        # 2. Strict isolation proven:
        # Either only loopback interface exists ('lo'), or all raw IP connects returned ENETUNREACH/EADDRNOTAVAIL
        only_loopback = bool(interfaces and set(interfaces) == {"lo"})
        if only_loopback or all_unreachable:
            obs = expected
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.PASS,
                expected=expected,
                observed=obs,
                evidence_ref="probe:network-egress",
                evidence_detail=(
                    f"Verified network isolation. Interfaces: {interfaces or 'unknown'}. "
                    f"Connect results: {connect_results}"
                ),
            )

        # 3. Non-loopback interfaces exist and connects failed only via timeout/refusal (unproven)
        obs = f"unproven network isolation: non-loopback interfaces present ({interfaces}), results: {connect_results}"
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.INCONCLUSIVE,
            expected=expected,
            observed=obs,
            evidence_ref="probe:network-egress",
            limitation=(
                "Outbound connection failed but interface is not restricted to loopback; "
                "failure cannot be proven as container network policy enforcement."
            ),
        )
