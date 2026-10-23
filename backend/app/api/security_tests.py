"""Security-test endpoints. Only registered tests can run; no free-form targets."""
from __future__ import annotations

import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Path, Query, Request

from app.database import DuplicateInfraResult
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

    The verdict is derived only from what the worker reported: error -> ERROR;
    COMPLETED -> PASS if observed == expected else FAIL; PENDING / UNAVAILABLE pass through.
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
    logger.info("infra check stored run_id=%s check=%s status=%s", run_id, body.check_id, status.value)
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
    try:
        # Clear any prior infra checks for this run so results can be cleanly re-submitted
        db.clear_infra_checks(run_id)

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
        )

        await run_in_threadpool(
            orchestrator.execute_and_submit,
            run_id,
            "worker-1",
            allow_host_fallback,
        )

        updated = request.app.state.runner.get_run(run_id)
        if updated is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "run_not_found", "message": f"Run '{run_id}' not found."},
            )
        return updated
    except HTTPException:
        raise
    except Exception as exc:
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

