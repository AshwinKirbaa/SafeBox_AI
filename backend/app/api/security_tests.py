"""Security-test endpoints. Only registered tests can run; no free-form targets."""
from __future__ import annotations

import hmac
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Path, Query, Request

from app.database import DuplicateInfraResult, REQUIRED_INFRA_CHECKS
from app.schemas import (
    InfraCheckResult,
    InfraCheckSubmission,
    InfraStatus,
    RunId,
    RunListResponse,
    RunRecord,
    RunRequest,
    SecurityTestListResponse,
    TargetMode,
    utc_now,
)
from app.services.runner import RunnerError
from app.services.activity_logger import log_worker_sandbox_check

logger = logging.getLogger("safebox.api")
router = APIRouter(prefix="/api/security-tests", tags=["security-tests"])

RunIdPath = Annotated[str, Path(pattern=r"^run_[0-9a-f]{32}$")]


@router.get("", response_model=SecurityTestListResponse)
def list_security_tests(request: Request) -> SecurityTestListResponse:
    return SecurityTestListResponse(items=request.app.state.registry.list_meta())


@router.post("/run", response_model=RunRecord)
def run_security_test(body: RunRequest, request: Request) -> RunRecord:
    """Synchronous: returns only after evaluation has completed (state COMPLETED/ABORTED)."""
    try:
        return request.app.state.runner.run(body)
    except RunnerError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": str(exc)})


@router.get("/runs", response_model=RunListResponse)
def list_runs(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
    provider: Annotated[str | None, Query()] = None,
    model: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
) -> RunListResponse:
    items, total = request.app.state.db.list_runs(
        limit, offset, provider=provider, model=model, status=status
    )
    return RunListResponse(items=items, total=total, limit=limit, offset=offset,
                           has_more=offset + len(items) < total)


@router.get("/runs/{run_id}", response_model=RunRecord)
def get_run(run_id: RunIdPath, request: Request) -> RunRecord:
    record = request.app.state.runner.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "run_not_found", "message": "Run not found."})
    return record


@router.get("/runs/{run_id}/audit-events")
def get_sandbox_audit_events(run_id: RunIdPath, request: Request) -> dict[str, Any]:
    if request.app.state.db.get_raw(run_id) is None:
        raise HTTPException(status_code=404, detail={"code": "run_not_found", "message": "Run not found."})
    events = request.app.state.sandbox_audit.read(run_id)
    return {"run_id": run_id, "events": events, "count": len(events)}


def _authorise_worker(request: Request, token: str | None) -> None:
    settings = request.app.state.settings
    expected = settings.worker_token.get_secret_value() if settings.worker_token else ""
    if expected:
        if not token or not hmac.compare_digest(token.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail={
                "code": "unauthorized", "message": "Missing or invalid X-Worker-Token."})
    elif settings.environment not in ("development", "test"):
        raise HTTPException(status_code=503, detail={
            "code": "worker_auth_not_configured",
            "message": "Set SAFEBOX_WORKER_TOKEN to accept worker results."})


@router.post("/runs/{run_id}/infrastructure-checks", response_model=InfraCheckResult, status_code=201)
def submit_infrastructure_check(
    run_id: RunIdPath, body: InfraCheckSubmission, request: Request,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> InfraCheckResult:
    """Accept one isolation-check result from the sandbox worker (Member 2).

    New workers submit an explicit verdict plus traceable evidence. Legacy workers
    retain the observed/expected comparison contract. Missing evidence never passes.
    """
    _authorise_worker(request, x_worker_token)
    if body.run_id != run_id:
        raise HTTPException(status_code=422, detail={
            "code": "run_id_mismatch", "message": "run_id in body must match the URL."})
    db = request.app.state.db
    if db.get_raw(run_id) is None:
        raise HTTPException(status_code=404, detail={"code": "run_not_found", "message": "Run not found."})

    if body.error and body.error.strip():
        status = InfraStatus.ERROR
    elif body.reported_state == "PENDING":
        status = InfraStatus.PENDING
    elif body.reported_state == "UNAVAILABLE":
        status = InfraStatus.UNAVAILABLE
    elif body.reported_verdict == "ERROR":
        status = InfraStatus.ERROR
    elif body.reported_verdict == "FAIL":
        status = InfraStatus.FAIL
    elif body.reported_verdict == "PASS":
        # A claimed PASS without traceable runtime evidence is not verified.
        status = (
            InfraStatus.PASS
            if body.evidence_ref and body.evidence_detail
            else InfraStatus.UNAVAILABLE
        )
    else:
        obs = body.observed.strip() if body.observed else ""
        exp = body.expected.strip() if body.expected else ""
        status = (
            InfraStatus.PASS
            if (obs and exp and body.observed == body.expected)
            else InfraStatus.FAIL
        )
    result = InfraCheckResult(**body.model_dump(), status=status, received_at=utc_now())
    try:
        db.add_infra_check(result)
    except DuplicateInfraResult:
        raise HTTPException(status_code=409, detail={
            "code": "duplicate_check", "message": "A result for this worker/check/run already exists."})
    try:
        request.app.state.sandbox_audit.record(
            run_id, "sandbox_check", worker_execution_id=body.worker_id,
            check_id=body.check_id, policy_version=body.policy_version,
            execution_status=body.reported_state.lower(), expected=body.expected,
            observed=body.observed, evidence_source=body.evidence_ref,
            evidence_summary=body.evidence_detail, duration_ms=body.duration_ms,
            verdict=status.value,
            error_type="check_execution" if body.error else None,
            error_message=body.error, persistence_status="persisted",
        )
    except Exception:
        db.delete_infra_check(run_id, body.worker_id, body.check_id)
        raise
    logger.info("infra check stored run_id=%s check=%s status=%s", run_id, body.check_id, status.value)
    log_worker_sandbox_check(
        run_id=run_id,
        check_id=body.check_id,
        worker_id=body.worker_id,
        status=status.value,
        observed=body.observed,
        expected=body.expected,
        error=body.error,
    )
    return result


@router.post("/runs/{run_id}/launch-worker", response_model=RunRecord)
async def launch_worker(
    run_id: RunIdPath,
    request: Request,
    allow_host_fallback: Annotated[bool, Query()] = False,
) -> RunRecord:
    """Launch the container sandbox isolation verification for the specified run.

    Passes configured backend URL and worker authentication token securely.
    Never exposes the worker token to the browser.
    Prevents duplicate submissions while a verification is running.
    """
    db = request.app.state.db
    record = request.app.state.runner.get_run(run_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "run_not_found", "message": f"Run '{run_id}' not found."},
        )

    # Concurrency guard: prevent duplicate running
    if not hasattr(request.app.state, "active_infra_verifications"):
        request.app.state.active_infra_verifications = set()
    if run_id in request.app.state.active_infra_verifications:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "verification_already_running",
                "message": f"Container sandbox verification is already in progress for run '{run_id}'.",
            },
        )

    # Worker token configuration check
    settings = request.app.state.settings
    token_str = settings.worker_token.get_secret_value() if settings.worker_token else ""
    if not token_str and settings.environment not in ("development", "test"):
        raise HTTPException(
            status_code=503,
            detail={
                "code": "worker_auth_not_configured",
                "message": "Worker token is not configured on the backend. Set SAFEBOX_WORKER_TOKEN in backend/.env.",
            },
        )

    # Ensure worker package is in sys.path
    import sys
    from pathlib import Path
    worker_root = Path(__file__).resolve().parent.parent.parent.parent / "worker"
    if str(worker_root) not in sys.path:
        sys.path.insert(0, str(worker_root))

    from starlette.concurrency import run_in_threadpool
    from worker.orchestrator.docker_runner import DockerSandboxOrchestrator

    docker_ok, docker_msg = DockerSandboxOrchestrator.is_docker_available()
    if not docker_ok and not allow_host_fallback:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "docker_unavailable",
                "message": (
                    f"Docker Desktop daemon is stopped or not running ({docker_msg}). "
                    "Please start Docker Desktop to execute hardened container sandbox verification."
                ),
            },
        )

    request.app.state.active_infra_verifications.add(run_id)
    audit = request.app.state.sandbox_audit
    try:
        audit.record(run_id, "run_initialization", worker_execution_id="worker-1", execution_status="started")
        # Clear any prior infra checks for this run so results can be cleanly re-submitted
        db.clear_infra_checks(run_id)
        audit.record(run_id, "container_preparation", worker_execution_id="worker-1", execution_status="started")

        from typing import Any
        from worker.models import InfraCheckSubmission
        from worker.submitter import InfraSubmitter

        def _in_proc_submit(sub: InfraCheckSubmission) -> dict[str, Any]:
            res = submit_infrastructure_check(
                run_id=sub.run_id,
                body=sub,
                request=request,
                x_worker_token=token_str,
            )
            return {"status": "created", "data": res.model_dump(), "check_id": sub.check_id}

        submitter = InfraSubmitter(
            backend_url=f"http://127.0.0.1:{settings.port}",
            token=token_str,
            submit_fn=_in_proc_submit,
        )

        orchestrator = DockerSandboxOrchestrator(
            backend_url=f"http://127.0.0.1:{settings.port}",
            worker_token=token_str,
            image_tag="safebox-worker:latest",
            submitter=submitter,
            event_sink=lambda stage, fields: audit.record(run_id, stage, **fields),
        )

        execution = await run_in_threadpool(
            orchestrator.execute_and_submit,
            run_id,
            "worker-1",
            allow_host_fallback,
        )
        submissions = execution.get("submissions", [])
        rejected = [s for s in submissions if s.get("status") != "created"]
        if rejected:
            db.clear_infra_checks(run_id)
            raise RuntimeError(f"{len(rejected)} infrastructure check submission(s) were not persisted")
        submitted_ids = [s.get("check_id") for s in submissions]
        if len(submitted_ids) != len(REQUIRED_INFRA_CHECKS) or set(submitted_ids) != set(REQUIRED_INFRA_CHECKS):
            db.clear_infra_checks(run_id)
            raise RuntimeError("Worker did not persist exactly the seven required infrastructure checks")

        updated = request.app.state.runner.get_run(run_id)
        if updated is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "run_not_found", "message": f"Run '{run_id}' not found."},
            )
        audit.record(
            run_id, "overall_verdict_aggregation", worker_execution_id="worker-1",
            execution_status="completed", verdict=updated.infrastructure.status.value,
            observed={"submitted_checks": len(updated.infrastructure.checks)},
            evidence_summary=updated.infrastructure.note, persistence_status="persisted",
        )
        audit.record(run_id, "container_cleanup", worker_execution_id="worker-1", execution_status="completed")
        audit.record(run_id, "final_execution_status", worker_execution_id="worker-1", execution_status="completed")
        return updated
    except HTTPException as exc:
        audit.record(
            run_id, "container_cleanup", worker_execution_id="worker-1", execution_status="completed"
        )
        audit.record(
            run_id, "final_execution_status", worker_execution_id="worker-1",
            execution_status="failed", verdict="ERROR", error_type="HTTPException",
            error_message=str(exc.detail), persistence_status="not_applicable",
        )
        raise
    except Exception as exc:
        audit.record(run_id, "container_cleanup", worker_execution_id="worker-1", execution_status="completed")
        audit.record(
            run_id, "final_execution_status", worker_execution_id="worker-1",
            execution_status="failed", verdict="ERROR", error_type=type(exc).__name__,
            error_message=str(exc), persistence_status="not_applicable",
        )
        logger.exception("Sandbox worker execution failed for %s: %s", run_id, exc)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "worker_execution_failed",
                "message": f"Sandbox worker execution failed: {exc}",
            },
        )
    finally:
        request.app.state.active_infra_verifications.discard(run_id)

