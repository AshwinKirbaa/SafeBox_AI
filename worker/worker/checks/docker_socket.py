"""Check that Docker daemon socket is not mounted or accessible."""

import os
from pathlib import Path
from typing import Any
from .base import BaseIsolationCheck
from ..models import CheckStatus, IsolationCheckResult


PROBE_SOCKET_PATHS = [
    "/var/run/docker.sock",
    "/run/docker.sock",
    "/var/run/dockershim.sock",
    "/run/containerd/containerd.sock",
    "/var/run/podman/podman.sock",
    "/run/podman/podman.sock",
    r"\\.\pipe\docker_engine",  # Windows named pipe
]


class DockerSocketCheck(BaseIsolationCheck):
    check_id = "docker-socket-absence"
    policy_id = "no-docker-socket"
    policy_version = "1.0.0"

    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        expected = "docker socket absent at all standard probe locations"
        detected_sockets: list[str] = []
        errors: list[str] = []

        # Check environment variables
        docker_host = os.environ.get("DOCKER_HOST")
        if docker_host:
            detected_sockets.append(f"DOCKER_HOST={docker_host}")

        # Probe paths
        for path_str in PROBE_SOCKET_PATHS:
            try:
                p = Path(path_str)
                if p.exists():
                    detected_sockets.append(str(p))
            except PermissionError:
                # Permission denied means a file exists but cannot be accessed; flag it
                detected_sockets.append(f"{path_str} (permission-denied)")
            except Exception as e:
                # Ignore invalid paths on non-Windows/non-Linux
                pass

        if detected_sockets:
            obs = f"docker socket detected at: {', '.join(detected_sockets)}"
            return IsolationCheckResult(
                check_id=self.check_id,
                policy_id=self.policy_id,
                policy_version=self.policy_version,
                status=CheckStatus.FAIL,
                expected=expected,
                observed=obs,
                evidence_ref="probe:docker-socket",
                evidence_detail=f"Probed paths: {', '.join(PROBE_SOCKET_PATHS)}. Found: {detected_sockets}",
            )

        obs = expected
        return IsolationCheckResult(
            check_id=self.check_id,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            status=CheckStatus.PASS,
            expected=expected,
            observed=obs,
            evidence_ref="probe:docker-socket",
            evidence_detail=f"Probed {len(PROBE_SOCKET_PATHS)} candidate locations; all absent.",
        )
