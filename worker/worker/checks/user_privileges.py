"""Check that worker executes under an unprivileged non-root user account."""

import os
import sys
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


class UserPrivilegesCheck(BaseIsolationCheck):
    check_id = "non-root-execution"
    policy_id = "non-root-user"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "executed by unprivileged non-root user (uid > 0)"

        if hasattr(os, "getuid"):
            uid = os.getuid()
            gid = os.getgid()
            groups = os.getgroups() if hasattr(os, "getgroups") else []
            if uid == 0 or gid == 0 or 0 in groups:
                obs = f"executed as privileged root user or group (uid={uid}, gid={gid}, groups={groups})"
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.FAIL,
                    expected=expected,
                    observed=obs,
                    evidence_ref="probe:process-credentials",
                    evidence_detail=f"Process credentials: uid={uid}, gid={gid}, groups={groups}",
                )
            else:
                obs = expected
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.PASS,
                    expected=expected,
                    observed=obs,
                    evidence_ref="probe:process-credentials",
                    evidence_detail=f"Process credentials: uid={uid}, gid={gid}, groups={groups}",
                )
        else:
            # Windows host environment
            try:
                import ctypes
                is_admin = bool(ctypes.windll.shell32.IsUserAnAdmin())
            except Exception:
                is_admin = False

            if is_admin:
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.FAIL,
                    expected=expected,
                    observed="executed with Windows Administrator privileges",
                    evidence_ref="probe:windows-token",
                    limitation="Evaluated on Windows host without container isolation.",
                )
            else:
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.UNAVAILABLE,
                    expected=expected,
                    observed="non-posix platform",
                    evidence_ref="probe:windows-token",
                    limitation="POSIX uid/gid check requires Linux container; Windows standard user detected.",
                )
