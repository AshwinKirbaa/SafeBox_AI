"""Check that cgroup resource limits (memory, pids, cpu) are enforced."""

from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


MAX_PERMITTED_MEMORY_BYTES = 256 * 1024 * 1024  # Must match docker_runner.py
MAX_PERMITTED_PIDS = 64


class ResourceLimitsCheck(BaseIsolationCheck):
    check_id = "resource-limits"
    policy_id = "bounded-cgroup-resources"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "memory and pid limits enforced (memory <= 256MiB, pids <= 64)"
        cgroup_root = Path(context.get("cgroup_root", "/sys/fs/cgroup"))

        if not cgroup_root.exists():
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.UNAVAILABLE,
                expected=expected,
                observed="cgroup filesystem unavailable",
                evidence_ref="probe:cgroup",
                limitation="/sys/fs/cgroup not mounted or not accessible in host environment.",
            )

        # 1. Check Memory Limit (cgroup v2 or v1)
        mem_limit_bytes: int | None = None
        mem_raw = ""
        mem_v2 = cgroup_root / "memory.max"
        mem_v1 = cgroup_root / "memory" / "memory.limit_in_bytes"

        if mem_v2.exists():
            mem_raw = mem_v2.read_text().strip()
            if mem_raw != "max":
                try:
                    mem_limit_bytes = int(mem_raw)
                except ValueError:
                    pass
        elif mem_v1.exists():
            mem_raw = mem_v1.read_text().strip()
            try:
                val = int(mem_raw)
                # In cgroup v1, unbounded is close to 2^63 - 1
                if val < (1 << 60):
                    mem_limit_bytes = val
            except ValueError:
                pass

        # 2. Check PIDs Limit (cgroup v2 or v1)
        pids_limit: int | None = None
        pids_raw = ""
        pids_v2 = cgroup_root / "pids.max"
        pids_v1 = cgroup_root / "pids" / "pids.max"

        if pids_v2.exists():
            pids_raw = pids_v2.read_text().strip()
            if pids_raw != "max":
                try:
                    pids_limit = int(pids_raw)
                except ValueError:
                    pass
        elif pids_v1.exists():
            pids_raw = pids_v1.read_text().strip()
            if pids_raw != "max":
                try:
                    pids_limit = int(pids_raw)
                except ValueError:
                    pass

        # Evaluate
        violations = []
        if mem_limit_bytes is None:
            violations.append(f"memory unbounded (raw={mem_raw or 'missing'})")
        elif mem_limit_bytes > MAX_PERMITTED_MEMORY_BYTES:
            violations.append(f"memory limit too high: {mem_limit_bytes} bytes > {MAX_PERMITTED_MEMORY_BYTES}")

        if pids_limit is None:
            violations.append(f"pids unbounded (raw={pids_raw or 'missing'})")
        elif pids_limit > MAX_PERMITTED_PIDS:
            violations.append(f"pids limit too high: {pids_limit} > {MAX_PERMITTED_PIDS}")

        if violations:
            obs = f"resource limits violated: {'; '.join(violations)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:cgroup",
                evidence_detail=f"cgroup probes: memory.max={mem_raw}, pids.max={pids_raw}",
            )

        obs = expected
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=obs,
            evidence_ref="probe:cgroup",
            evidence_detail=f"memory_limit={mem_limit_bytes} bytes, pids_limit={pids_limit}",
        )
