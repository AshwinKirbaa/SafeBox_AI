"""Check that sensitive host files and mounts are not accessible."""

from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


PROHIBITED_HOST_PATHS = [
    # Host root mounts
    "/host",
    "/hostfs",
    "/mnt/c",
    "/mnt/host",
    "/run/host",
    # Sensitive credentials / system state
    "/etc/shadow",
    "/etc/sudoers",
    "/etc/sudoers.d",
    "/root/.ssh",
    "/root/.bash_history",
    # Kernel / hardware debug mounts
    "/proc/kcore",
    "/proc/sysrq-trigger",
    # Windows system files if running or mounted
    r"C:\Windows\System32\config\SAM",
    r"C:\Users",
]


class HostFilesystemProtectionCheck(BaseIsolationCheck):
    check_id = "host-filesystem-protection"
    policy_id = "no-prohibited-host-mounts"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "no prohibited host paths mounted or accessible"
        accessible_targets: list[str] = []

        for p_str in PROHIBITED_HOST_PATHS:
            try:
                p = Path(p_str)
                if p.is_file():
                    # Attempt to read to verify actual readability
                    with open(p, "rb") as f:
                        f.read(32)
                    accessible_targets.append(f"readable file: {p_str}")
                elif p.is_dir():
                    # Attempt to list directory
                    items = list(p.iterdir())
                    if items:
                        accessible_targets.append(f"accessible dir: {p_str} ({len(items)} items)")
            except (PermissionError, FileNotFoundError):
                # Expected behavior: file either does not exist or permission denied
                pass
            except Exception:
                pass

        if accessible_targets:
            obs = f"prohibited host access detected: {'; '.join(accessible_targets)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:host-filesystem",
                evidence_detail=f"Probed {len(PROHIBITED_HOST_PATHS)} paths. Breaches: {accessible_targets}",
            )

        obs = expected
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=obs,
            evidence_ref="probe:host-filesystem",
            evidence_detail=f"Probed {len(PROHIBITED_HOST_PATHS)} prohibited host paths; all absent or unreadable.",
        )
