"""Host-side orchestrator for launching SafeBox Member 2 sandbox containers.

Manages:
- Ephemeral per-run workspace directories
- Spawning hardened Linux containers with:
  * Non-root user (10001:10001)
  * Dropped capabilities (--cap-drop=ALL)
  * No new privileges (--security-opt=no-new-privileges:true)
  * Read-only root filesystem (--read-only, tmpfs on /tmp)
  * Strict resource bounds (--memory=256m, --cpus=0.5, --pids-limit=64)
  * Complete network isolation (--network=none)
  * Isolated workspace bind-mount (no Docker socket, no host root)
- Host-side mount isolation verification
- Reconciling host and container evidence (host may confirm or downgrade, never upgrade)
- Safe cleanup of workspaces, sentinels, and Docker containers
- Forwarding verified results to Member 1 backend API
"""

import json
import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable
from ..config import find_env_token
from ..models import CheckStatus, InfraCheckSubmission, IsolationCheckResult
from ..submitter import InfraSubmitter

logger = logging.getLogger("safebox.worker.orchestrator")

RUN_ID_REGEX = re.compile(r"^run_[0-9a-f]{32}$")

REQUIRED_CHECK_IDS = [
    "docker-socket-absence",
    "non-root-execution",
    "dropped-capabilities",
    "resource-limits",
    "workspace-isolation",
    "host-filesystem-protection",
    "network-egress",
]


def validate_run_id(run_id: str) -> None:
    """Validate that run_id matches strict format to prevent path traversal."""
    if not isinstance(run_id, str) or not RUN_ID_REGEX.match(run_id):
        raise ValueError(f"Invalid run_id format: {run_id!r}. Must match {RUN_ID_REGEX.pattern}")


class DockerSandboxOrchestrator:
    def __init__(
        self,
        backend_url: str = "http://127.0.0.1:8000",
        worker_token: str | None = None,
        image_tag: str = "safebox-worker:latest",
        workspaces_base_dir: str | None = None,
        submitter: InfraSubmitter | None = None,
        event_sink: Callable[[str, dict[str, Any]], None] | None = None,
    ):
        self.backend_url = backend_url.rstrip("/")
        self.worker_token = worker_token or find_env_token()
        self.image_tag = image_tag
        self.workspaces_base_dir = (
            Path(workspaces_base_dir) if workspaces_base_dir
            else Path(tempfile.gettempdir()) / "safebox_workspaces"
        )
        self.submitter = submitter or InfraSubmitter(backend_url=self.backend_url, token=self.worker_token)
        self.event_sink = event_sink

    def _emit(self, stage: str, **fields: Any) -> None:
        if self.event_sink is not None:
            self.event_sink(stage, fields)

    @staticmethod
    def _ensure_docker_in_path() -> None:
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            docker_bin = Path(local_app) / "Programs" / "DockerDesktop" / "resources" / "bin"
            if docker_bin.is_dir() and str(docker_bin) not in os.environ.get("PATH", ""):
                os.environ["PATH"] = f"{docker_bin}{os.pathsep}{os.environ.get('PATH', '')}"

    @classmethod
    def is_docker_available(cls) -> tuple[bool, str]:
        """Check if Docker CLI and daemon are operational."""
        cls._ensure_docker_in_path()
        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5,
            )
            if res.returncode == 0:
                return True, "Docker daemon is operational"
            return False, f"Docker daemon error (exit {res.returncode}): {res.stderr.strip()}"
        except FileNotFoundError:
            return False, "Docker executable not found in PATH"
        except subprocess.TimeoutExpired:
            return False, "Docker command timed out (daemon unresponsive)"
        except Exception as e:
            return False, f"Docker check failed: {e}"

    def prepare_workspaces(self, run_id: str) -> tuple[Path, Path]:
        """Create isolated current workspace and adjacent protected workspace with symlink protection."""
        validate_run_id(run_id)
        self.workspaces_base_dir.mkdir(parents=True, exist_ok=True)
        base_resolved = self.workspaces_base_dir.resolve()

        run_workspace = (base_resolved / run_id).resolve()
        adjacent_workspace = (base_resolved / f"{run_id}_adjacent").resolve()

        # Guard against directory traversal
        try:
            run_workspace.relative_to(base_resolved)
            adjacent_workspace.relative_to(base_resolved)
        except ValueError:
            raise ValueError(f"Run ID path traversal detected: {run_id}")

        # Guard against planted symlinks
        if run_workspace.is_symlink():
            raise RuntimeError(f"Planted symlink detected at run workspace path: {run_workspace}")
        if adjacent_workspace.is_symlink():
            raise RuntimeError(f"Planted symlink detected at adjacent workspace path: {adjacent_workspace}")

        run_workspace.mkdir(parents=True, exist_ok=True)
        adjacent_workspace.mkdir(parents=True, exist_ok=True)

        # Create adjacent workspace sentinel exclusively without following symlinks
        secret_file = adjacent_workspace / "protected_secret.txt"
        if secret_file.is_symlink():
            raise RuntimeError(f"Planted symlink detected at adjacent sentinel path: {secret_file}")

        secret_file.unlink(missing_ok=True)
        open_flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
        if hasattr(os, "O_NOFOLLOW"):
            open_flags |= os.O_NOFOLLOW

        fd = os.open(str(secret_file), open_flags, 0o600)
        try:
            os.write(fd, b"CONFIDENTIAL_ADJACENT_RUN_DATA\n")
        finally:
            os.close(fd)

        return run_workspace, adjacent_workspace

    def cleanup_workspaces(self, run_id: str) -> None:
        """Safely clean up workspace directories and sentinels without following symlinks."""
        try:
            validate_run_id(run_id)
        except ValueError:
            return

        base_resolved = self.workspaces_base_dir.resolve()
        targets = [
            (base_resolved / run_id).resolve(),
            (base_resolved / f"{run_id}_adjacent").resolve(),
            (base_resolved / f"adjacent_{run_id}").resolve(),
        ]

        def _safe_remove(target: Path) -> None:
            if not target.exists() and not target.is_symlink():
                return
            if target.is_symlink():
                target.unlink(missing_ok=True)
                return
            try:
                target.relative_to(base_resolved)
            except ValueError:
                logger.warning("Refusing to clean up path outside workspaces base: %s", target)
                return

            for root, dirs, files in os.walk(str(target), topdown=False, followlinks=False):
                for f in files:
                    fp = Path(root) / f
                    fp.unlink(missing_ok=True)
                for d in dirs:
                    dp = Path(root) / d
                    if dp.is_symlink():
                        dp.unlink(missing_ok=True)
                    else:
                        try:
                            dp.rmdir()
                        except OSError:
                            pass
            try:
                target.rmdir()
            except OSError:
                pass

        for t in targets:
            _safe_remove(t)

    def build_docker_run_args(
        self,
        run_id: str,
        workspace_path: Path,
        worker_id: str = "worker-1",
    ) -> list[str]:
        """Construct hardened docker container run arguments."""
        validate_run_id(run_id)
        container_name = f"safebox-worker-{run_id.replace('run_', '')[:12]}"
        host_workspace_mount = str(workspace_path.resolve())

        args = [
            "docker", "run", "--rm",
            "--name", container_name,
            # Security boundaries:
            "--user", "10001:10001",
            "--security-opt=no-new-privileges:true",
            "--cap-drop=ALL",
            # Read-only filesystem with small isolated tmpfs
            "--read-only",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
            # Resource constraints:
            "--memory=256m",
            "--memory-swap=256m",
            "--cpus=0.5",
            "--pids-limit=64",
            # Complete network isolation (no egress, no ingress)
            "--network=none",
            # Volume mount only designated workspace
            "-v", f"{host_workspace_mount}:/workspace:rw",
            # Image and entrypoint arguments
            self.image_tag,
            "--run-id", run_id,
            "--worker-id", worker_id,
            "--workspace-dir", "/workspace",
            "--json",
        ]
        return args

    def verify_host_mount_isolation(
        self,
        cmd: list[str],
        run_workspace: Path,
        adjacent_workspace: Path,
    ) -> tuple[bool, str | None, dict[str, Any]]:
        """Verify host-side isolation prerequisites and Docker mount arguments.

        Verifies:
        1. Current workspace exists and is a directory.
        2. Adjacent workspace exists and contains the protected_secret.txt sentinel.
        3. Current and adjacent workspace paths are distinct.
        4. Exactly one bind mount is present in Docker arguments, mounting the
           current workspace to /workspace:rw or /workspace.
        5. The adjacent workspace is NOT mounted.
        """
        # 1. Current workspace must exist and be a directory
        if not run_workspace.exists() or not run_workspace.is_dir():
            return False, f"Current run workspace does not exist or is not a directory: {run_workspace}", {}

        # 2. Adjacent workspace must exist and be a directory
        if not adjacent_workspace.exists() or not adjacent_workspace.is_dir():
            return False, f"Adjacent workspace does not exist or is not a directory: {adjacent_workspace}", {}

        # 3. Current and adjacent workspaces must be distinct
        run_ws_resolved = str(run_workspace.resolve()).lower()
        adj_ws_resolved = str(adjacent_workspace.resolve()).lower()
        if run_ws_resolved == adj_ws_resolved:
            return False, "Current run workspace and adjacent workspace resolve to the exact same path", {}

        # 4. Sentinel file must exist in adjacent workspace
        sentinel = adjacent_workspace / "protected_secret.txt"
        if not sentinel.exists() or not sentinel.is_file():
            return False, f"Adjacent workspace sentinel 'protected_secret.txt' missing in {adjacent_workspace}", {}

        # 5. Inspect Docker argument list for mount configurations
        mount_specs: list[tuple[str, str]] = []
        i = 0
        while i < len(cmd):
            arg = cmd[i]
            if arg in ("-v", "--volume", "--mount"):
                if i + 1 < len(cmd):
                    mount_specs.append((arg, cmd[i + 1]))
                    i += 2
                    continue
            elif arg.startswith(("-v=", "--volume=", "--mount=")):
                flag, val = arg.split("=", 1)
                mount_specs.append((flag, val))
            i += 1

        if len(mount_specs) == 0:
            return False, "No bind mount present in Docker command line", {}

        if len(mount_specs) > 1:
            return False, f"Unexpected extra bind mount(s) detected in Docker arguments: {[m[1] for m in mount_specs]}", {}

        flag, mount_arg = mount_specs[0]

        if flag in ("--mount", "--mount="):
            parts = dict(p.split("=", 1) for p in mount_arg.split(",") if "=" in p)
            src = parts.get("src") or parts.get("source") or ""
            dst = parts.get("dst") or parts.get("destination") or parts.get("target")
            ro = parts.get("readonly") or parts.get("ro")
            if dst != "/workspace" or ro in ("true", "1"):
                return False, f"Mount container target must be '/workspace' and writable (found '{mount_arg}')", {}
            host_src = src
        else:
            sep_idx = mount_arg.rfind(":/")
            if sep_idx == -1:
                return False, f"Invalid mount specification format: {mount_arg}", {}
            host_src = mount_arg[:sep_idx]
            container_dst = mount_arg[sep_idx + 1:]
            if container_dst != "/workspace:rw":
                return False, f"Mount container target must be exactly '/workspace:rw' (found '{container_dst}')", {}

        try:
            host_src_resolved = str(Path(host_src).resolve()).lower()
        except Exception as e:
            return False, f"Failed to resolve host mount source '{host_src}': {e}", {}

        if host_src_resolved != run_ws_resolved:
            return False, f"Mount source '{host_src}' does not match current run workspace '{run_workspace}'", {}

        if host_src_resolved == adj_ws_resolved:
            return False, f"Mount source '{host_src}' resolves to adjacent workspace", {}

        evidence = {
            "mount_spec": mount_arg,
            "run_workspace": str(run_workspace.resolve()),
            "adjacent_workspace": str(adjacent_workspace.resolve()),
            "sentinel_file": str(sentinel.resolve()),
        }
        return True, None, evidence

    def run_in_docker(
        self,
        run_id: str,
        worker_id: str = "worker-1",
        run_workspace: Path | None = None,
        adjacent_workspace: Path | None = None,
    ) -> dict[str, Any]:
        """Run isolation checks inside Docker container, verify host mount isolation, and return reconciled report."""
        validate_run_id(run_id)
        docker_ok, docker_msg = self.is_docker_available()
        if not docker_ok:
            raise RuntimeError(f"Cannot run in Docker: {docker_msg}")

        custom_ws = run_workspace is not None and adjacent_workspace is not None
        if custom_ws:
            run_ws, adj_ws = run_workspace, adjacent_workspace
        else:
            run_ws, adj_ws = self.prepare_workspaces(run_id)

        container_name = f"safebox-worker-{run_id.replace('run_', '')[:12]}"
        cmd = self.build_docker_run_args(run_id, run_ws, worker_id=worker_id)
        self._emit(
            "docker_configuration_validation", worker_execution_id=worker_id,
            execution_status="completed",
            expected={"user": "10001:10001", "memory": "256m", "pids": 64, "network": "none"},
            observed={"security_flags": [a for a in cmd if a.startswith("--")]},
            evidence_source="orchestrator:docker-run-args",
        )

        # 1. Host-side verification of workspace isolation prerequisites and mount arguments
        host_ok, host_err, host_evidence = self.verify_host_mount_isolation(cmd, run_ws, adj_ws)

        logger.info("Executing container: %s", " ".join(cmd))
        self._emit("worker_startup", worker_execution_id=worker_id, execution_status="started")
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=30,
            )
        except subprocess.TimeoutExpired:
            # Force cleanup of timed-out container
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=10)
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            raise TimeoutError(f"Container execution timed out for run {run_id}")

        if proc.returncode != 0:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=10)
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            raise RuntimeError(
                f"Container execution failed (code {proc.returncode}):\nStdout: {proc.stdout}\nStderr: {proc.stderr}"
            )
        self._emit("worker_startup", worker_execution_id=worker_id, execution_status="completed")

        try:
            report = json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            raise RuntimeError(f"Failed to parse container JSON output: {e}\nRaw output: {proc.stdout}")

        # 2. Output integrity validation: run_id and duplicate check_id detection
        report_run_id = report.get("run_id")
        if report_run_id and report_run_id != run_id:
            logger.error("Container report run_id mismatch: expected %s, got %s", run_id, report_run_id)
            # Mark all checks with error for wrong-run container output
            for c in report.get("checks", []):
                c["status"] = CheckStatus.ERROR.value
                c["error"] = f"Container output run_id mismatch: expected {run_id}, got {report_run_id}"

        checks = report.get("checks", [])
        seen_check_ids = set()
        has_duplicates = False
        for c in checks:
            cid = c.get("check_id")
            if cid in seen_check_ids:
                has_duplicates = True
                c["status"] = CheckStatus.ERROR.value
                c["error"] = f"Duplicate check_id in container report: {cid}"
            seen_check_ids.add(cid)

        # 3. Host reconciliation for workspace-isolation:
        # Host may ONLY confirm or downgrade a verdict; NEVER upgrade container INCONCLUSIVE to PASS.
        ws_check = next((c for c in checks if c.get("check_id") == "workspace-isolation"), None)

        if ws_check is None:
            # Container output omitted workspace verification
            checks.append({
                "check_id": "workspace-isolation",
                "policy_id": "per-run-workspace-separation",
                "policy_version": "1.0.0",
                "status": CheckStatus.INCONCLUSIVE.value,
                "expected": "isolated run workspace accessible; adjacent run workspaces inaccessible",
                "observed": "container workspace verification missing",
                "limitation": "Missing container workspace verification: check was omitted from container output.",
                "error": "Missing container workspace verification result",
            })
            report["checks"] = checks
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            return report

        c_status = ws_check.get("status")
        c_observed = ws_check.get("observed", "")
        c_error = ws_check.get("error")
        c_evidence_detail = ws_check.get("evidence_detail", "")

        # 4. If actual cross-workspace access breach was detected by container, preserve FAIL
        if c_status == CheckStatus.FAIL.value or "cross-workspace isolation breach" in c_observed:
            ws_check["status"] = CheckStatus.FAIL.value
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            return report

        # 5. If container reported ERROR or unwritable workspace, retain ERROR
        if c_status == CheckStatus.ERROR.value or "unwritable" in c_observed or "mismatch" in c_observed:
            ws_check["status"] = CheckStatus.ERROR.value
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            return report

        # 6. If container reported INCONCLUSIVE:
        # Host MUST NOT upgrade it to PASS! Retain INCONCLUSIVE.
        if c_status == CheckStatus.INCONCLUSIVE.value:
            ws_check["status"] = CheckStatus.INCONCLUSIVE.value
            if not host_ok:
                ws_check["limitation"] = f"Container reported inconclusive and host verification failed: {host_err}"
            else:
                ws_check["limitation"] = ws_check.get("limitation") or "Container workspace probe was inconclusive."
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            return report

        # 7. If host-side mount isolation verification failed, downgrade container PASS to INCONCLUSIVE
        if not host_ok:
            ws_check["status"] = CheckStatus.INCONCLUSIVE.value
            ws_check["observed"] = f"workspace isolation could not be verified: {host_err}"
            ws_check["evidence_ref"] = "host:mount-isolation-failed"
            ws_check["evidence_detail"] = f"Host-side verification failed: {host_err}"
            ws_check["limitation"] = f"Host-side isolation verification failed: {host_err}"
            if not custom_ws:
                self.cleanup_workspaces(run_id)
            return report

        # 8. Both container probe passed and host mount isolation verified -> Confirmed PASS
        expected = ws_check.get("expected") or "isolated run workspace accessible; adjacent run workspaces inaccessible"
        ws_check["status"] = CheckStatus.PASS.value
        ws_check["expected"] = expected
        ws_check["observed"] = expected
        ws_check["evidence_ref"] = "host-container-dual-verification:workspace-isolation"
        ws_check["evidence_detail"] = (
            f"Host verified single isolated bind-mount ({host_evidence.get('mount_spec', 'unknown')}), "
            f"confirmed adjacent sentinel exists at {host_evidence.get('adjacent_workspace', 'unknown')}, "
            f"and confirmed no adjacent workspace was mounted. "
            f"Container verified designated workspace writable and read-back intact with zero breaches detected."
        )
        ws_check["limitation"] = None
        ws_check["error"] = None

        if not custom_ws:
            self.cleanup_workspaces(run_id)
        return report

    def execute_and_submit(
        self,
        run_id: str,
        worker_id: str = "worker-1",
        allow_fallback: bool = True,
    ) -> dict[str, Any]:
        """Execute isolation verification and submit results to Member 1 backend."""
        validate_run_id(run_id)
        docker_ok, docker_msg = self.is_docker_available()

        if docker_ok:
            try:
                self._emit("security_check_initialization", worker_execution_id=worker_id, execution_status="started")
                report = self.run_in_docker(run_id, worker_id)
                checks_data = report.get("checks", [])
                submissions = []
                for c in checks_data:
                    check_res = IsolationCheckResult(**c)
                    submissions.append(check_res.to_submission(worker_id=worker_id, run_id=run_id))
                submit_reports = self.submitter.submit_all(submissions)
                persisted = all(s.get("status") == "created" for s in submit_reports)
                self._emit(
                    "database_persistence", worker_execution_id=worker_id,
                    execution_status="completed" if persisted else "failed",
                    observed={"submission_count": len(submit_reports)},
                    persistence_status="persisted" if persisted else "failed",
                )
                return {
                    "mode": "container",
                    "run_id": run_id,
                    "worker_id": worker_id,
                    "docker_available": True,
                    "submissions": submit_reports,
                    "raw_checks": checks_data,
                }
            except Exception as e:
                logger.error("Container execution failed for run %s: %s", run_id, e)
                from datetime import datetime, timezone
                from ..checks import ALL_CHECKS
                submissions = []
                now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                for cls in ALL_CHECKS:
                    inst = cls()
                    sub = InfraCheckSubmission(
                        worker_id=worker_id,
                        run_id=run_id,
                        check_id=inst.check_id,
                        policy_id=inst.policy_id,
                        policy_version=inst.policy_version,
                        reported_state="COMPLETED",
                        observed=None,
                        expected=None,
                        timestamp=now_iso,
                        error=f"Container execution error: {e}"[:500],
                        evidence_ref="orchestrator:docker-error",
                    )
                    submissions.append(sub)
                submit_reports = self.submitter.submit_all(submissions)
                persisted = all(s.get("status") == "created" for s in submit_reports)
                self._emit(
                    "database_persistence", worker_execution_id=worker_id,
                    execution_status="completed" if persisted else "failed",
                    observed={"submission_count": len(submit_reports)},
                    persistence_status="persisted" if persisted else "failed",
                )
                return {
                    "mode": "container",
                    "run_id": run_id,
                    "worker_id": worker_id,
                    "docker_available": True,
                    "docker_error": str(e),
                    "submissions": submit_reports,
                    "raw_checks": [],
                }
            finally:
                self.cleanup_workspaces(run_id)
        else:
            if not allow_fallback:
                raise RuntimeError(f"Docker is not available: {docker_msg}")

            logger.warning("Docker unavailable (%s). Running local verification and reporting UNAVAILABLE / FAIL checks.", docker_msg)
            from ..runner import IsolationCheckRunner
            runner = IsolationCheckRunner()
            try:
                run_ws, adj_ws = self.prepare_workspaces(run_id)
                context = {"workspace_dir": str(run_ws), "adjacent_workspace_dir": str(adj_ws)}
                results, submissions = runner.run_and_prepare_submissions(worker_id, run_id, context)

                for s in submissions:
                    # A host process cannot prove or disprove the boundaries of the
                    # container that never started. Preserve its observations as
                    # diagnostic evidence, but never promote them to PASS/FAIL for
                    # the hardened-container plane.
                    prior_error = s.error
                    s.reported_state = "UNAVAILABLE"
                    s.reported_verdict = None
                    s.error = None
                    note = (
                        f"Container isolation unavailable because Docker could not start ({docker_msg}). "
                        "Observed values are host-only diagnostics, not a container verdict."
                    )
                    if prior_error:
                        note += f" Host diagnostic error: {prior_error}"
                    s.limitation = f"{s.limitation} {note}"[:500] if s.limitation else note[:500]

                submit_reports = self.submitter.submit_all(submissions)
                persisted = all(s.get("status") == "created" for s in submit_reports)
                self._emit(
                    "database_persistence", worker_execution_id=worker_id,
                    execution_status="completed" if persisted else "failed",
                    observed={"submission_count": len(submit_reports)},
                    persistence_status="persisted" if persisted else "failed",
                )
                return {
                    "mode": "host_fallback",
                    "run_id": run_id,
                    "worker_id": worker_id,
                    "docker_available": False,
                    "docker_reason": docker_msg,
                    "submissions": submit_reports,
                    "raw_checks": [r.model_dump() for r in results],
                }
            finally:
                self.cleanup_workspaces(run_id)


def main() -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="SafeBox AI Sandbox Orchestrator (Host Runner)")
    parser.add_argument("--run-id", required=True, help="Security test run ID to attach isolation checks to")
    parser.add_argument("--worker-id", default=os.getenv("SAFEBOX_WORKER_ID", "worker-1"), help="Worker ID")
    parser.add_argument("--backend-url", default=os.getenv("SAFEBOX_BACKEND_URL", "http://127.0.0.1:8000"), help="Backend URL")
    parser.add_argument("--token", default=os.getenv("SAFEBOX_WORKER_TOKEN"), help="Worker token")
    parser.add_argument("--image-tag", default="safebox-worker:latest", help="Docker worker image tag")
    parser.add_argument("--json", action="store_true", help="Output JSON result")
    args = parser.parse_args()

    orchestrator = DockerSandboxOrchestrator(
        backend_url=args.backend_url,
        worker_token=args.token,
        image_tag=args.image_tag,
    )
    res = orchestrator.execute_and_submit(run_id=args.run_id, worker_id=args.worker_id)
    # A 409 "duplicate" means the backend kept older results and did NOT accept this worker's output.
    failed_submissions = [s for s in res.get("submissions", []) if s.get("status") in ("failed", "duplicate")]
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"Orchestrator finished in mode '{res['mode']}' for run {args.run_id}")
        print(f"Docker available: {res['docker_available']}")
        if not res['docker_available']:
            print(f"Note: {res.get('docker_reason')}")
        print(f"Submissions: {len(res['submissions'])} checks posted to {args.backend_url}")
        for s in res['submissions']:
            status_val = s.get('status')
            err_val = f": {s.get('error')}" if s.get('error') else ""
            print(f"  Check '{s.get('check_id')}': {status_val}{err_val}")

    if failed_submissions:
        n_dup = sum(1 for s in failed_submissions if s.get("status") == "duplicate")
        if n_dup:
            print(f"\n[ERROR] {n_dup} check(s) already recorded for this run; existing results were NOT overwritten. "
                  "Use a new run, or 'Run verification' in the UI (it clears prior results first).", file=sys.stderr)
        print(f"\n[ERROR] {len(failed_submissions)} of {len(res.get('submissions', []))} check submissions were not accepted!", file=sys.stderr)
        return 1

    if not res.get("submissions"):
        print("\n[ERROR] No check submissions were generated or posted.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
