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

        # 1. Verify designated workspace write and read-back access safely without following symlinks
        try:
            workspace_dir.mkdir(parents=True, exist_ok=True)
            test_marker = workspace_dir / ".isolation_probe.tmp"

            if test_marker.is_symlink():
                test_marker.unlink()
            elif test_marker.exists():
                test_marker.unlink()

            open_flags = os.O_CREAT | os.O_EXCL | os.O_RDWR
            if hasattr(os, "O_NOFOLLOW"):
                open_flags |= os.O_NOFOLLOW

            fd = os.open(str(test_marker), open_flags, 0o600)
            try:
                os.write(fd, b"worker_probe")
            finally:
                os.close(fd)

            if test_marker.is_symlink():
                raise OSError("Planted symlink detected at probe file location")

            r_flags = os.O_RDONLY
            if hasattr(os, "O_NOFOLLOW"):
                r_flags |= os.O_NOFOLLOW
            r_fd = os.open(str(test_marker), r_flags)
            try:
                content = os.read(r_fd, 64).decode("utf-8")
            finally:
                os.close(r_fd)

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

        # 2. Discover adjacent workspace candidate paths
        candidates: list[Path] = []
        breaches: list[str] = []
        probe_errors: list[str] = []
        probed_count = 0

        if adjacent_dir:
            candidates.append(Path(adjacent_dir))

        # Check standard container paths where other workspaces might be mounted
        workspaces_parent = workspace_dir.parent
        if workspaces_parent.name == "workspaces" and workspaces_parent.exists():
            try:
                for child in workspaces_parent.iterdir():
                    if child.is_dir() and child.resolve() != workspace_dir.resolve():
                        candidates.append(child)
            except (PermissionError, OSError) as e:
                probe_errors.append(f"probe error listing parent workspaces {workspaces_parent}: {e}")

        # In container environment, /workspaces is the designated multi-run workspaces tree
        # /workspaces is the shared parent container, not an adjacent run workspace itself
        alt_workspaces = Path("/workspaces")
        if alt_workspaces.exists() and alt_workspaces.resolve() != workspace_dir.resolve():
            try:
                for child in alt_workspaces.iterdir():
                    if child.resolve() != workspace_dir.resolve() and child not in candidates:
                        try:
                            if child.is_dir():
                                candidates.append(child)
                        except PermissionError:
                            # Kernel DAC blocked stat; candidate path retained for probe verification
                            candidates.append(child)
            except (PermissionError, OSError) as e:
                probe_errors.append(f"probe error listing shared workspaces {alt_workspaces}: {e}")

        # Deduplicate candidate paths
        unique_candidates: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            k = str(candidate)
            if k not in seen:
                seen.add(k)
                unique_candidates.append(candidate)

        # 3. Probe each candidate for accessibility or secret access
        blocked_canaries: list[str] = []
        for target in unique_candidates:
            target_is_dir = False
            try:
                if not target.exists():
                    # Missing path cannot prove an isolation boundary exists
                    continue
                target_is_dir = target.is_dir()
            except PermissionError:
                # Permission denied on inspection confirms path exists but access is restricted
                target_is_dir = True
            except Exception as e:
                probe_errors.append(f"unexpected error inspecting target {target}: {e}")
                continue

            if not target_is_dir:
                continue

            probed_count += 1

            # Probe directory accessibility
            try:
                listing = list(target.iterdir())
                # If directory is readable without PermissionError, that is an access breach
                # (even an empty adjacent directory exposes cross-run access)
                breaches.append(f"accessible adjacent directory {target} (entries={len(listing)})")
            except PermissionError:
                # Expected when access is correctly blocked by kernel DAC boundary
                blocked_canaries.append(str(target))
            except FileNotFoundError:
                probe_errors.append(f"candidate directory vanished during probe: {target}")
            except Exception as e:
                probe_errors.append(f"probe error on directory {target}: {e}")

            # Probe protected secret file inside directory
            secret_file = target / "protected_secret.txt"
            try:
                if secret_file.exists() and secret_file.is_file():
                    content = secret_file.read_text(encoding="utf-8", errors="replace")
                    breaches.append(f"read protected file at {secret_file} (length={len(content)})")
            except (PermissionError, FileNotFoundError):
                pass
            except Exception as e:
                probe_errors.append(f"probe error on secret file {secret_file}: {e}")

        # 4. Result evaluation
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

        if probed_count == 0:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.INCONCLUSIVE,
                expected=expected,
                observed="adjacent workspace isolation could not be verified",
                evidence_ref="probe:workspace-isolation",
                evidence_detail=(
                    f"Designated workspace {workspace_dir} verified writable and read-back intact. "
                    "No existing adjacent workspace paths were available inside container "
                    "to probe; isolation is not verified from container alone."
                ),
                limitation="No accessible adjacent workspace path was available for a meaningful isolation probe.",
            )

        if probe_errors and not breaches:
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.INCONCLUSIVE,
                expected=expected,
                observed="adjacent workspace probe error",
                evidence_ref="probe:workspace-isolation",
                evidence_detail=f"Probed {probed_count} adjacent paths with errors: {probe_errors}",
                limitation=f"Probe encountered unexpected filesystem error(s): {'; '.join(probe_errors)}",
            )

        evidence_note = f" (confirmed boundary denial on {', '.join(blocked_canaries)})" if blocked_canaries else ""
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=expected,
            evidence_ref="probe:workspace-isolation",
            evidence_detail=f"Workspace {workspace_dir} verified. No access breach detected across {probed_count} adjacent path(s){evidence_note}.",
        )
