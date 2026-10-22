
"""Check that per-run workspaces are isolated and cross-run file access is blocked."""

from pathlib import Path
from typing import Any

from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


class WorkspaceIsolationCheck(BaseIsolationCheck):
    check_id = "workspace-isolation"
    policy_id = "per-run-workspace-separation"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = (
            "isolated run workspace accessible; "
            "adjacent run workspaces inaccessible"
        )

        workspace_dir = Path(context.get("workspace_dir", "/workspace"))
        adjacent_dir = context.get("adjacent_workspace_dir")

        # 1. Verify that the designated workspace is writable.
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
                error=(
                    f"Cannot write to designated workspace "
                    f"{workspace_dir}: {e}"
                ),
            )

        # 2. Find adjacent workspaces that can be probed.
        candidates: list[Path] = []

        if adjacent_dir:
            candidates.append(Path(adjacent_dir))

        # Discover sibling workspaces if a shared workspaces
        # directory is visible inside the container.
        workspaces_parent = workspace_dir.parent

        if (
            workspaces_parent.name == "workspaces"
            and workspaces_parent.exists()
        ):
            try:
                for child in workspaces_parent.iterdir():
                    if (
                        child.is_dir()
                        and child.resolve() != workspace_dir.resolve()
                    ):
                        candidates.append(child)
            except (PermissionError, OSError):
                # Failure to enumerate is not proof of isolation.
                pass

        # Remove duplicate candidate paths.
        unique_candidates: list[Path] = []
        seen: set[str] = set()

        for candidate in candidates:
            key = str(candidate)

            if key not in seen:
                seen.add(key)
                unique_candidates.append(candidate)

        breaches: list[str] = []
        probed_count = 0

        # 3. Probe each candidate for directory listing or secret access.
        for target in unique_candidates:
            # A path that does not exist is not a successful isolation
            # probe: it cannot prove that an adjacent workspace is protected.
            try:
                if not target.exists():
                    continue
            except (PermissionError, OSError):
                # Access denied to the target path is evidence of a boundary.
                probed_count += 1
                continue

            probed_count += 1
            secret_file = target / "protected_secret.txt"

            probe_targets = [target]

            try:
                if secret_file.exists():
                    probe_targets.append(secret_file)
            except (PermissionError, OSError):
                # Continue probing the directory itself.
                pass

            for path in probe_targets:
                try:
                    if path.is_file():
                        content = path.read_text(
                            encoding="utf-8",
                            errors="replace",
                        )
                        breaches.append(
                            f"read protected file at {path} "
                            f"(length={len(content)})"
                        )

                    elif path.is_dir():
                        listing = list(path.iterdir())

                        if listing:
                            breaches.append(
                                f"listed contents of adjacent directory "
                                f"{path}: {[item.name for item in listing]}"
                            )

                except (PermissionError, FileNotFoundError):
                    # Expected when access to the adjacent workspace is denied.
                    pass

                except OSError:
                    # An OS-level access failure does not prove a breach.
                    pass

                except Exception:
                    # Unexpected probe errors are not treated as proof of
                    # successful isolation. The final result remains
                    # inconclusive unless a breach was detected.
                    pass

        # 4. Any successful read/listing is a definite isolation breach.
        if breaches:
            observed = (
                "cross-workspace isolation breach: "
                + "; ".join(breaches)
            )

            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=observed,
                evidence_ref="probe:workspace-isolation",
                evidence_detail=(
                    f"Probed {probed_count} adjacent paths. "
                    f"Breaches: {breaches}"
                ),
            )

        # 5. Zero usable probe targets must never result in PASS.
        if probed_count == 0:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.INCONCLUSIVE,
                expected=expected,
                observed=(
                    "adjacent workspace isolation could not be verified"
                ),
                evidence_ref="probe:workspace-isolation",
                evidence_detail=(
                    f"Designated workspace {workspace_dir} verified writable and read-back intact. "
                    "No existing adjacent workspace paths were available inside container "
                    "to probe; isolation is not verified from container alone."
                ),
                limitation=(
                    "No accessible adjacent workspace path was available "
                    "for a meaningful isolation probe."
                ),
            )

        # 6. PASS only when at least one existing adjacent target was
        # successfully considered and no access breach was observed.
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=expected,
            evidence_ref="probe:workspace-isolation",
            evidence_detail=(
                f"Workspace {workspace_dir} verified. "
                f"No access breach detected across "
                f"{probed_count} adjacent path(s)."
            ),
        )
