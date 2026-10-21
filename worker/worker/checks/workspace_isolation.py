"""Check that per-run workspaces are isolated and cross-run file access is blocked."""

import os
from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


class WorkspaceIsolationCheck(BaseIsolationCheck):
    check_id = "workspace-isolation"
    policy_id = "per-run-workspace-separation"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "isolated run workspace accessible; adjacent run workspaces inaccessible"
        workspace_dir = Path(context.get("workspace_dir", "/workspace"))
        adjacent_dir = context.get("adjacent_workspace_dir")

        # 1. Verify local workspace write access
        try:
            workspace_dir.mkdir(parents=True, exist_ok=True)
            test_marker = workspace_dir / ".isolation_probe.tmp"
            test_marker.write_text("worker_probe", encoding="utf-8")
            content = test_marker.read_text(encoding="utf-8")
            test_marker.unlink(missing_ok=True)
            if content != "worker_probe":
                return IsolationCheckResult(
                    check_id=self.check_id,
                    policy_id=self.policy_id,
                    policy_version=self.policy_version,
                    status=CheckStatus.ERROR,
                    expected=expected,
                    observed="workspace read-back mismatch",
                    error="Local workspace read-back verification failed",
                )
        except Exception as e:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.ERROR,
                expected=expected,
                observed="workspace unwritable",
                error=f"Cannot write to designated workspace {workspace_dir}: {e}",
            )

        # 2. Check adjacent workspace isolation
        # Candidate paths to probe for cross-run leakage
        candidates: list[Path] = []
        if adjacent_dir:
            candidates.append(Path(adjacent_dir))

        # Check standard container paths where other workspaces might be mounted
        workspaces_parent = workspace_dir.parent
        if workspaces_parent.name == "workspaces" and workspaces_parent.exists():
            for child in workspaces_parent.iterdir():
                if child.is_dir() and child.resolve() != workspace_dir.resolve():
                    candidates.append(child)

        breaches: list[str] = []
        probed_count = 0

        for target in candidates:
            probed_count += 1
            # Probe target directory or protected files inside it
            secret_file = target / "protected_secret.txt"
            probe_targets = [target, secret_file] if secret_file.exists() else [target]

            for p in probe_targets:
                try:
                    if p.is_file():
                        content = p.read_text(encoding="utf-8", errors="replace")
                        breaches.append(f"read protected file at {p} (length={len(content)})")
                    elif p.is_dir():
                        listing = list(p.iterdir())
                        if listing:
                            breaches.append(f"listed contents of adjacent directory {p}: {[x.name for x in listing]}")
                except (PermissionError, FileNotFoundError):
                    # Expected: access blocked
                    pass
                except Exception as e:
                    # Other filesystem errors
                    pass

        if breaches:
            obs = f"cross-workspace isolation breach: {'; '.join(breaches)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:workspace-isolation",
                evidence_detail=f"Probed {probed_count} adjacent paths. Breaches: {breaches}",
            )

        obs = expected
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=obs,
            evidence_ref="probe:workspace-isolation",
            evidence_detail=f"Workspace {workspace_dir} verified. Adjacent workspaces inaccessible or unmounted (probed: {probed_count}).",
        )
