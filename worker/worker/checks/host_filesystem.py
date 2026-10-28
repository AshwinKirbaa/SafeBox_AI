"""Check that prohibited host mounts are not exposed to the container.

Container-owned files such as /etc/shadow are not evidence of host exposure.  The
check therefore combines mount-table inspection with probes of explicit host mount
locations instead of treating ordinary container paths as host files.
"""

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
        mount_evidence: list[str] = []
        mountinfo_verified = False

        # mountinfo identifies actual mount boundaries.  It lets us distinguish the
        # container's own /etc files from a host bind mount targeting /etc or /root.
        try:
            mount_lines = Path("/proc/self/mountinfo").read_text(encoding="utf-8", errors="replace").splitlines()
            mountinfo_verified = bool(mount_lines)
            for line in mount_lines:
                left, _, right = line.partition(" - ")
                fields = left.split()
                if len(fields) < 5:
                    continue
                target = fields[4].replace("\\040", " ")
                source = right.split()[1] if len(right.split()) > 1 else "unknown"
                if target in ("/host", "/hostfs", "/mnt/host", "/run/host", "/root") or target.startswith("/host/"):
                    mount_evidence.append(f"{source} -> {target}")
        except (FileNotFoundError, PermissionError, OSError):
            # Path probes below still provide useful runtime evidence.
            pass

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

        breaches = mount_evidence + accessible_targets
        if breaches:
            obs = f"prohibited host access detected: {'; '.join(breaches)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:host-filesystem",
                evidence_detail=f"Inspected mountinfo and probed {len(PROHIBITED_HOST_PATHS)} host mount paths. Breaches: {breaches}",
            )

        if not mountinfo_verified:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.INCONCLUSIVE,
                expected=expected,
                observed="host mount table could not be inspected",
                evidence_ref="probe:host-filesystem",
                evidence_detail=f"Probed {len(PROHIBITED_HOST_PATHS)} explicit host mount paths, but /proc/self/mountinfo was unavailable.",
                limitation="Mount-table evidence is required before host filesystem protection can be verified.",
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
            evidence_detail=(
                f"Inspected /proc/self/mountinfo and probed {len(PROHIBITED_HOST_PATHS)} explicit "
                "host mount paths; no prohibited host mount was found or readable. Container-owned "
                "system files were intentionally excluded because they do not prove host exposure."
            ),
        )
