# SafeBox AI — Member 2 Sandbox Worker & Infrastructure Isolation

Member 2 implements real, verifiable container sandboxing and infrastructure security evaluation for **SafeBox AI**. It provides the hardened Linux container worker, automated verification checks, and host-side orchestration that submits results to Member 1's backend API (`POST /api/security-tests/runs/{run_id}/infrastructure-checks`).

---

## 1. Architecture & Threat Model

```
+---------------------------------------------------------------+
|                      HOST (Windows / Linux)                   |
|                                                               |
|  Member 1 Backend: http://127.0.0.1:8000                      |
|  - Runs AI test evaluations (mock or local Ollama)            |
|  - Holds SQLite run history & evidence database               |
|  - Never grants host networking to the container worker       |
|                                                               |
|  Host Orchestrator (worker.orchestrator.docker_runner):       |
|  - Creates per-run isolated workspaces                        |
|  - Spawns hardened Docker worker containers                   |
|  - Collects JSON evidence from stdout                         |
|  - Submits InfraCheckSubmission records to Member 1 API       |
+-------------------------------+-------------------------------+
                                |
                   docker run (hardened)
                                v
+---------------------------------------------------------------+
|            DOCKER CONTAINER (safebox-worker:latest)           |
|                                                               |
|  * Non-root user:       UID 10001, GID 10001 (safebox)        |
|  * Capabilities:        --cap-drop=ALL (CapEff: 0x0)          |
|  * Privileges:          --security-opt=no-new-privileges:true |
|  * Filesystem:          --read-only, tmpfs on /tmp            |
|  * Resource bounds:     --memory=256m, --cpus=0.5, pids=64    |
|  * Network policy:      --network=none (egress blocked)       |
|  * Storage boundary:    Only /workspace bound for this run    |
|  * Prohibited mounts:   No /var/run/docker.sock, no host root |
|                                                               |
|  Verification probes execute inside container:                |
|  [docker-socket, non-root, capabilities, cgroups, workspace,  |
|   host-filesystem, network-egress]                            |
+---------------------------------------------------------------+
```

### Key Architectural Decisions:
1. **Model Isolation**: Model inference stays on the host (backend). The container worker has `--network=none` and never communicates directly with Ollama, the Docker daemon, or the external network.
2. **Deterministic Status Contract**:
   - `PASS`: Observed behavior matches expected policy (`observed == expected`).
   - `FAIL`: Isolation breach detected (e.g. adjacent workspace read, socket found).
   - `ERROR`: Unhandled runtime failure during check execution.
   - `UNAVAILABLE`: Prerequisite missing (e.g. Docker Desktop daemon not running, procfs unavailable on host).
   - `MISSING`: No worker result submitted for this run.

---

## 2. Implemented Isolation Policies

| Check ID | Policy ID | Description | Hardening Flag |
|---|---|---|---|
| `docker-socket-absence` | `no-docker-socket` | Verifies `/var/run/docker.sock` and daemon sockets are unmounted and absent | Default container policy |
| `non-root-execution` | `non-root-user` | Enforces UID > 0 and GID > 0; blocks root/admin execution | `--user 10001:10001` |
| `dropped-capabilities` | `cap-drop-all` | Verifies all effective Linux capabilities are 0 in `/proc/self/status` | `--cap-drop=ALL` |
| `resource-limits` | `bounded-cgroup-resources` | Verifies memory limit (<=512 MiB) and PID limit (<=256) via cgroups | `--memory=256m --pids-limit=64` |
| `workspace-isolation` | `per-run-workspace-separation` | Tests per-run temporary directories; verifies adjacent workspaces are inaccessible | Ephemeral per-run mount |
| `host-filesystem-protection`| `no-prohibited-host-mounts` | Probes for prohibited host paths (`/etc/shadow`, `/root/.ssh`, host disks) | Isolated volume bind |
| `network-egress` | `egress-deny-all` | Tests direct IP connects + interface inspection; distinguishes proven network isolation (`lo` only, `ENETUNREACH`) from DNS timeouts | `--network=none` |

---

## 3. Windows PowerShell Instructions (Docker Desktop)

### Prerequisites:
1. Member 1 Backend running at `http://127.0.0.1:8000`.
2. Docker Desktop installed and running on Windows.

### Step 1: Build the Worker Image
```powershell
cd "d:\Projects\SafeBox ai\safebox-ai\worker"
docker build -t safebox-worker:latest .
```

### Step 2: Run Worker via Orchestrator Convenience Script
```powershell
powershell -ExecutionPolicy Bypass -File .\run_worker.ps1
```
This script will:
1. Automatically create a test run on Member 1's backend if no `RunId` is provided.
2. Check Docker availability.
3. Launch the container with all security parameters.
4. Capture evidence and post results to Member 1 backend.
5. Display the aggregated status and check details.

### Step 3: Run Against an Existing Run ID
```powershell
powershell -ExecutionPolicy Bypass -File .\run_worker.ps1 -RunId "run_6797ef272d20416c96674997c050996d"
```

### Manual Container Execution (Reference)
```powershell
$runId = "run_your_id_here"
$hostWorkspace = "$env:TEMP\safebox_workspaces\$runId"
New-Item -ItemType Directory -Force -Path $hostWorkspace

docker run --rm `
  --name "safebox-worker-manual" `
  --user 10001:10001 `
  --security-opt=no-new-privileges:true `
  --cap-drop=ALL `
  --read-only `
  --tmpfs /tmp:rw,noexec,nosuid,size=64m `
  --memory=256m `
  --memory-swap=256m `
  --cpus=0.5 `
  --pids-limit=64 `
  --network=none `
  -v "${hostWorkspace}:/workspace:rw" `
  safebox-worker:latest `
  --run-id $runId `
  --worker-id "worker-1" `
  --json
```

---

## 4. Running the Tests

The test suite validates check logic, container argument construction, status derivation, and end-to-end API submission:

```powershell
cd "d:\Projects\SafeBox ai"
.\safebox-ai\backend\.venv\Scripts\python.exe -m pytest -v safebox-ai\worker\tests
```

77 isolation tests pass (39 unit/contract + 38 automated negative), covering:
- Unit tests for all checks under PASS, FAIL, ERROR, UNAVAILABLE, and INCONCLUSIVE conditions
- Mocking network interfaces and raw socket errors (`ENETUNREACH`, `EADDRNOTAVAIL`, `ETIMEDOUT`)
- End-to-end integration tests submitting to Member 1's backend API and validating HTTP 201, 401, 409, and 422 contracts.
- Automated negative tests (`test_isolation_negative.py`) verifying every check rejects its corresponding unsafe condition via both mock fixtures and live disposable Docker containers.

---

## 5. Security Scope & Verified Limitations

> [!CAUTION]
> **Important Isolation Limitations**:
> - Ordinary Linux container controls (namespaces, cgroups, capability drops) provide process isolation and resource limits, **not** mathematical proof of host-escape protection against zero-day Linux kernel vulnerabilities.
> - When running outside a container (e.g. host fallback mode when Docker Desktop is offline), POSIX capabilities and cgroups are reported as `UNAVAILABLE` with clear diagnostic limitations; SafeBox never reports an unexecuted check as a pass.
> - **Fixed-path probe scope**: `docker-socket-absence` and `host-filesystem-protection` verify known high-risk paths (`PROBE_SOCKET_PATHS`, `PROHIBITED_HOST_PATHS`). They do not perform exhaustive recursive filesystem scans and cannot detect custom unlisted host mount paths.
> - **TCP-based egress scope**: `network-egress` verifies interface restriction (`lo` only) and tests direct TCP socket connections across multiple IP endpoints. It relies on the container's network namespace (`--network=none`) rather than live packet inspection for UDP or raw ICMP protocols.
> - Connection failures caused by DNS misconfiguration or external timeout with non-loopback interfaces present are marked `INCONCLUSIVE` rather than `PASS` unless interface-level restriction to loopback (`lo`) or explicit `ENETUNREACH` is proven.

