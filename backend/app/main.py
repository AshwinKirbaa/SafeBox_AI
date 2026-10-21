"""FastAPI application factory. Starts in mock mode without Ollama."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.connections import router as connections_router
from app.api.security_tests import router as security_router
from app.config import Settings, get_settings
from app.database import Database
from app.schemas import HealthResponse, OllamaStatus, TargetMode, utc_now
from app.services.adapter_registry import SUPPORTED_PROVIDERS_META
from app.services.evidence import EvidenceService
from app.services.ollama_adapter import OllamaAdapter
from app.services.runner import AdapterFactory, SecurityTestRunner
from app.services.test_registry import TestRegistry

__version__ = "1.0.0"
logger = logging.getLogger("safebox")


def _error(status: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


def create_app(settings: Settings | None = None,
               adapter_factory: AdapterFactory | None = None) -> FastAPI:
    settings = settings or get_settings()
    registry = TestRegistry()
    db = Database(settings.database_path)
    evidence = EvidenceService(registry.sensitive_values(), settings.evidence_max_excerpt_chars)
    runner = SecurityTestRunner(settings, registry, db, evidence, adapter_factory)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db.init()
        purged = db.purge_expired(settings.evidence_retention_days)
        logger.info("SafeBox started mode=%s purged_runs=%d", settings.target_mode.value, purged)
        yield

    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
    app.state.settings, app.state.registry = settings, registry
    app.state.db, app.state.runner = db, runner

    @app.middleware("http")
    async def limit_request_size(request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            length = request.headers.get("content-length")
            if length is None and "chunked" in request.headers.get("transfer-encoding", "").lower():
                return _error(411, "length_required", "Content-Length is required.")
            if length is not None:
                if not length.isdigit():
                    return _error(400, "bad_request", "Invalid Content-Length.")
                if int(length) > settings.max_request_bytes:
                    return _error(413, "payload_too_large",
                                  f"Request body exceeds {settings.max_request_bytes} bytes.")
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Only location/message/type: never echo the submitted input back.
        details = [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"], "type": e["type"]}
                   for e in exc.errors()]
        return _error(422, "validation_error", "Request validation failed.", details)

    @app.exception_handler(HTTPException)
    async def on_http_error(_: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            return _error(exc.status_code, exc.detail["code"], exc.detail["message"])
        return _error(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def on_unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled error type=%s", type(exc).__name__)
        return _error(500, "internal_error", "Internal server error.")

    @app.get("/api/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        ollama = None
        if settings.target_mode == TargetMode.ollama or settings.allow_ollama_target:
            adapter = OllamaAdapter(settings.ollama_base_url, settings.ollama_model,
                                    settings.inference_timeout_seconds, settings.max_response_chars)
            reachable, available = adapter.check_available()
            ollama = OllamaStatus(reachable=reachable, configured_model=settings.ollama_model,
                                  model_available=available)
        return HealthResponse(
            app_name=settings.app_name, environment=settings.environment, version=__version__,
            target_mode=settings.target_mode, database_ok=db.ping(), ollama=ollama,
            supported_providers=[p["id"] for p in SUPPORTED_PROVIDERS_META], time=utc_now())

    app.include_router(security_router)
    app.include_router(connections_router)
    return app


app = create_app()
