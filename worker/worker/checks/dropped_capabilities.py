"""Check that Linux capabilities have been dropped (--cap-drop=ALL)."""

import os
from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


class DroppedCapabilitiesCheck(BaseIsolationCheck):
    check_id = "dropped-capabilities"
    policy_id = "cap-drop-all"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "all effective capabilities dropped (CapEff=0000000000000000)"
        proc_status = Path("/proc/self/status")

        if not proc_status.exists():
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.UNAVAILABLE,
                expected=expected,
                observed="procfs unavailable",
                evidence_ref="probe:proc-status",
                limitation="/proc/self/status not available outside Linux container.",
            )

        try:
            status_text = proc_status.read_text(encoding="utf-8", errors="replace")
            caps: dict[str, str] = {}
            for line in status_text.splitlines():
                if line.startswith("Cap"):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        caps[parts[0].strip()] = parts[1].strip()

            cap_eff_hex = caps.get("CapEff", "")
            cap_bnd_hex = caps.get("CapBnd", "")

            # Normalise hex string
            val_eff = int(cap_eff_hex, 16) if cap_eff_hex else -1

            if val_eff == 0:
                obs = expected
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.PASS,
                    expected=expected,
                    observed=obs,
                    evidence_ref="probe:proc-status",
                    evidence_detail=f"CapEff={cap_eff_hex}, CapBnd={cap_bnd_hex}, CapPrm={caps.get('CapPrm', '')}",
                )
            else:
                obs = f"effective capabilities retained: CapEff={cap_eff_hex}"
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.FAIL,
                    expected=expected,
                    observed=obs,
                    evidence_ref="probe:proc-status",
                    evidence_detail=f"CapEff={cap_eff_hex} (non-zero indicates retainment). Bounding: {cap_bnd_hex}",
                )
        except Exception as e:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.ERROR,
                expected=expected,
                observed="error reading capabilities",
                error=f"Failed to read /proc/self/status: {e}",
            )
