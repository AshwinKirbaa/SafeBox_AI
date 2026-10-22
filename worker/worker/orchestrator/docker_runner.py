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
- Parsing JSON evidence from container stdout
- Forwarding verified results to Member 1 backend API
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from ..config import find_env_token
from ..models import CheckStatus, InfraCheckSubmission, IsolationCheckResult
from ..submitter import InfraSubmitter

logger = logging.getLogger("safebox.worker.orchestrator")


class DockerSandboxOrchestrator:
    def __init__(
        self,
        backend_url: str = "http://127.0.0.1:8000",
        worker_token: str | None = None,
        image_tag: str = "safebox-worker:latest",
        workspaces_base_dir: str | None = None,
        submitter: InfraSubmitter | None = None,
    ):
        self.backend_url = backend_url.rstrip("/")
        self.worker_token = worker_token or find_env_token()
        self.image_tag = image_tag
        self.workspaces_base_dir = (
            Path(workspaces_base_dir) if workspaces_base_dir
            else Path(tempfile.gettempdir()) / "safebox_workspaces"
        )
        self.submitter = submitter or InfraSubmitter(backend_url=self.backend_url, token=self.worker_token)

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
        """Create isolated current workspace and adjacent protected workspace."""
        self.workspaces_base_dir.mkdir(parents=True, exist_ok=True)
        run_workspace = self.workspaces_base_dir / run_id
        run_workspace.mkdir(parents=True, exist_ok=True)

        # Create adjacent workspace containing a protected file for cross-run isolation check
        adjacent_workspace = self.workspaces_base_dir / f"adjacent_{run_id}"
        adjacent_workspace.mkdir(parents=True, exist_ok=True)
        secret_file = adjacent_workspace / "protected_secret.txt"
        secret_file.write_text("CONFIDENTIAL_ADJACENT_RUN_DATA", encoding="utf-8")

        return run_workspace, adjacent_workspace

    def build_docker_run_args(
        self,
        run_id: str,
        workspace_path: Path,
        worker_id: str = "worker-1",
    ) -> list[str]:
        """Construct hardened docker container run arguments."""
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

    def run_in_docker(self, run_id: str, worker_id: str = "worker-1") -> dict[str, Any]:
        """Run isolation checks inside Docker container and return parsed report."""
        docker_ok, docker_msg = self.is_docker_available()
        if not docker_ok:
            raise RuntimeError(f"Cannot run in Docker: {docker_msg}")

        run_ws, adj_ws = self.prepare_workspaces(run_id)
        cmd = self.build_docker_run_args(run_id, run_ws, worker_id=worker_id)

        logger.info("Executing container: %s", " ".join(cmd))
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
        )

        if proc.returncode != 0:
            raise RuntimeError(
                f"Container execution failed (code {proc.returncode}):\nStdout: {proc.stdout}\nStderr: {proc.stderr}"
            )

        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse container JSON output: {e}\nRaw output: {proc.stdout}")

    def execute_and_submit(
        self,
        run_id: str,
        worker_id: str = "worker-1",
        allow_fallback: bool = True,
    ) -> dict[str, Any]:
        """Execute isolation verification and submit results to Member 1 backend."""
        docker_ok, docker_msg = self.is_docker_available()

        if docker_ok:
            try:
                report = self.run_in_docker(run_id, worker_id)
                checks_data = report.get("checks", [])
                submissions = []
                for c in checks_data:
                    check_res = IsolationCheckResult(**c)
                    submissions.append(check_res.to_submission(worker_id=worker_id, run_id=run_id))
                submit_reports = self.submitter.submit_all(submissions)
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
                return {
                    "mode": "container",
                    "run_id": run_id,
                    "worker_id": worker_id,
                    "docker_available": True,
                    "docker_error": str(e),
                    "submissions": submit_reports,
                    "raw_checks": [],
                }
        else:
            if not allow_fallback:
                raise RuntimeError(f"Docker is not available: {docker_msg}")

            logger.warning("Docker unavailable (%s). Running local verification and reporting UNAVAILABLE / FAIL checks.", docker_msg)
            from ..runner import IsolationCheckRunner
            runner = IsolationCheckRunner()
            run_ws, adj_ws = self.prepare_workspaces(run_id)
            context = {"workspace_dir": str(run_ws), "adjacent_workspace_dir": str(adj_ws)}
            results, submissions = runner.run_and_prepare_submissions(worker_id, run_id, context)

            for s in submissions:
                # If a breach was detected (observed != expected, status FAIL), preserve the failure.
                # If the check would have reported PASS, never claim container isolation under host fallback.
                # Convert to UNAVAILABLE with explicit diagnostic limitation.
                if s.reported_state == "COMPLETED" and s.observed == s.expected:
                    s.reported_state = "UNAVAILABLE"
                    s.observed = None
                    s.expected = None
                    s.limitation = f"Docker unavailable on host ({docker_msg}); container isolation not verified."
                elif s.check_id in ("dropped-capabilities", "resource-limits"):
                    s.reported_state = "UNAVAILABLE"
                    s.observed = None
                    s.expected = None
                    s.limitation = f"Docker Desktop unavailable on host: {docker_msg}"

            submit_reports = self.submitter.submit_all(submissions)
            return {
                "mode": "host_fallback",
                "run_id": run_id,
                "worker_id": worker_id,
                "docker_available": False,
                "docker_reason": docker_msg,
                "submissions": submit_reports,
                "raw_checks": [r.model_dump() for r in results],
            }


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
    failed_submissions = [s for s in res.get("submissions", []) if s.get("status") == "failed"]
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
        print(f"\n[ERROR] {len(failed_submissions)} of {len(res.get('submissions', []))} check submissions failed!", file=sys.stderr)
        return 1

    if not res.get("submissions"):
        print("\n[ERROR] No check submissions were generated or posted.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())

