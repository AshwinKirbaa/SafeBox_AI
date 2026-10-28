"""API endpoints for model connections, provider discovery, and connection checks.

Enforces security controls:
- Secrets are never returned over API endpoints.
- SSRF protections are enforced on custom endpoints.
- Model discovery does not execute adversarial prompts.
"""
from __future__ import annotations

import logging
import re
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request

from app.schemas import (
    ConnectionId,
    ConnectionLiveVerifyRequest,
    ConnectionLiveVerifyResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ModelCapabilitiesSchema,
    ModelType,
    ProviderMetaResponse,
    SavedConnectionCreate,
    SavedConnectionListResponse,
    SavedConnectionResponse,
    SavedConnectionUpdate,
    TargetConfig,
    TestStatus,
    TokenUsageSummary,
    RunRequest,
)
from app.services.model_adapter import ConnectionCheckResult
from app.services.model_probe import probe_model
from app.services.adapter_registry import SUPPORTED_PROVIDERS_META, AdapterRegistry
from app.services.provider_adapters import sanitize_secrets_from_text
from app.services.activity_logger import (
    log_connection_saved,
    log_connection_test,
    log_live_verification_audit,
    log_live_verification_started,
    log_model_selection,
)

logger = logging.getLogger("safebox.api.connections")
router = APIRouter(prefix="/api/connections", tags=["connections"])

_CONNECTION_MODEL_SENTINELS = {"__connection__", "connection-default"}


def _discovery_model(value: str | None) -> str | None:
    """Do not pass provider-only storage sentinels into validated target configs."""
    return None if not value or value in _CONNECTION_MODEL_SENTINELS else value


@router.get("/providers", response_model=list[ProviderMetaResponse])
def list_providers() -> list[ProviderMetaResponse]:
    """List all supported inference providers and their declared capabilities."""
    return [
        ProviderMetaResponse(
            id=p["id"],
            name=p["name"],
            tier=p["tier"],
            description=p["description"],
            requires_api_key=p["requires_api_key"],
            requires_base_url=p["requires_base_url"],
            default_base_url=p.get("default_base_url"),
            default_model=p.get("default_model"),
            is_remote=p["is_remote"],
            capabilities=ModelCapabilitiesSchema(**p["capabilities"]),
        )
        for p in SUPPORTED_PROVIDERS_META
    ]


@router.get("", response_model=SavedConnectionListResponse)
def list_saved_connections(request: Request) -> SavedConnectionListResponse:
    """List all configured model connections (API keys are masked)."""
    items = request.app.state.db.list_connections()
    return SavedConnectionListResponse(items=items)


@router.post("", response_model=SavedConnectionResponse, status_code=201)
def create_connection(body: SavedConnectionCreate, request: Request) -> SavedConnectionResponse:
    """Save a model connection profile. Stored secrets are masked and never echoed back."""
    resp = request.app.state.db.save_connection(
        name=body.name,
        provider=body.provider,
        model=body.model,
        base_url=body.base_url,
        api_key=body.api_key,
        custom_headers=body.custom_headers,
        request_template=body.request_template,
        response_path=body.response_path,
        model_type=body.model_type,
    )
    logger.info("Saved connection created id=%s name=%s provider=%s", resp.connection_id, resp.name, resp.provider)
    log_connection_saved(
        action="created",
        name=resp.name,
        provider=resp.provider,
        model=resp.model,
        base_url=resp.base_url,
        has_api_key=resp.has_api_key,
        masked_key=resp.masked_api_key,
        connection_id=resp.connection_id,
    )
    return resp


@router.get("/{connection_id}", response_model=SavedConnectionResponse)
def get_connection(
    connection_id: Annotated[str, Path(pattern=r"^conn_[0-9a-f]{16,32}$")],
    request: Request,
) -> SavedConnectionResponse:
    conn = request.app.state.db.get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})
    return SavedConnectionResponse(
        connection_id=conn["connection_id"],
        name=conn["name"],
        provider=conn["provider"],
        model=conn["model"],
        base_url=conn["base_url"],
        has_api_key=conn["has_api_key"],
        masked_api_key=conn["masked_api_key"],
        custom_headers=conn["custom_headers"],
        request_template=conn["request_template"],
        response_path=conn["response_path"],
        model_type=conn.get("model_type", ModelType.chat),
        created_at=conn["created_at"],
        updated_at=conn["updated_at"],
    )


@router.patch("/{connection_id}", response_model=SavedConnectionResponse)
def update_connection(
    connection_id: Annotated[str, Path(pattern=r"^conn_[0-9a-f]{16,32}$")],
    body: SavedConnectionUpdate,
    request: Request,
) -> SavedConnectionResponse:
    existing = request.app.state.db.get_connection(connection_id)
    if not existing:
        raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})

    name = body.name if body.name is not None else existing["name"]
    model = body.model if body.model is not None else existing["model"]
    base_url = body.base_url if body.base_url is not None else existing["base_url"]
    if body.api_key is not None and body.api_key.strip():
        api_key = body.api_key.strip()
    else:
        api_key = existing.get("api_key")
    custom_headers = body.custom_headers if body.custom_headers is not None else existing["custom_headers"]
    request_template = body.request_template if body.request_template is not None else existing["request_template"]
    response_path = body.response_path if body.response_path is not None else existing["response_path"]
    model_type = body.model_type if body.model_type is not None else existing.get("model_type", ModelType.chat)

    resp = request.app.state.db.save_connection(
        name=name,
        provider=existing["provider"],
        model=model,
        base_url=base_url,
        api_key=api_key,
        custom_headers=custom_headers,
        request_template=request_template,
        response_path=response_path,
        connection_id=connection_id,
        model_type=model_type,
    )
    logger.info("Saved connection updated id=%s", connection_id)
    log_connection_saved(
        action="updated",
        name=resp.name,
        provider=resp.provider,
        model=resp.model,
        base_url=resp.base_url,
        has_api_key=resp.has_api_key,
        masked_key=resp.masked_api_key,
        connection_id=resp.connection_id,
    )
    return resp


@router.delete("/{connection_id}", status_code=204)
def delete_connection(
    connection_id: Annotated[str, Path(pattern=r"^conn_[0-9a-f]{16,32}$")],
    request: Request,
) -> None:
    deleted = request.app.state.db.delete_connection(connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})
    logger.info("Saved connection deleted id=%s", connection_id)


@router.post("/test", response_model=ConnectionTestResponse)
def test_connection(body: ConnectionTestRequest, request: Request) -> ConnectionTestResponse:
    """Test reachability and discover models/capabilities without sending prompt inferences."""
    conn_data = None
    if body.connection_id:
        conn_data = request.app.state.db.get_connection(body.connection_id)
        if not conn_data:
            raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})

    model_type = body.model_type or (
        ModelType(conn_data.get("model_type", ModelType.chat.value)) if conn_data else ModelType.chat
    )
    target_cfg = TargetConfig(
        provider=body.provider or (conn_data.get("provider") if conn_data else None),
        model=_discovery_model(body.model or (conn_data.get("model") if conn_data else None)),
        base_url=body.base_url or (conn_data.get("base_url") if conn_data else None),
        api_key=body.api_key or (conn_data.get("api_key") if conn_data else None),
        model_type=model_type,
    )

    try:
        adapter_connection_data = dict(conn_data) if conn_data else None
        if adapter_connection_data and adapter_connection_data.get("model") in _CONNECTION_MODEL_SENTINELS:
            adapter_connection_data["model"] = None
        adapter = AdapterRegistry.create_adapter(
            request.app.state.settings,
            target_cfg,
            connection_data=adapter_connection_data,
        )
        res = adapter.check_connection(timeout_seconds=5.0)
        caps = ModelCapabilitiesSchema(**res.capabilities.to_dict()) if res.capabilities else None
        log_connection_test(
            provider=target_cfg.provider or "unknown",
            model=target_cfg.model or "unknown",
            base_url=target_cfg.base_url,
            reachable=res.reachable,
            latency_ms=res.latency_ms,
            discovered_models=list(res.discovered_models),
            capabilities=res.capabilities.to_dict() if res.capabilities else None,
            error=res.error_message,
        )
        return ConnectionTestResponse(
            reachable=res.reachable,
            model_available=res.model_available,
            latency_ms=res.latency_ms,
            capabilities=caps,
            discovered_models=list(res.discovered_models),
            error_message=res.error_message,
            model_type=model_type,
            compatible=res.model_available is not False,
        )
    except Exception as exc:
        log_connection_test(
            provider=target_cfg.provider or "unknown",
            model=target_cfg.model or "unknown",
            base_url=target_cfg.base_url,
            reachable=False,
            error=str(exc),
        )
        return ConnectionTestResponse(
            reachable=False,
            model_available=False,
            error_message=f"Connection test failed: {exc}",
            model_type=model_type,
            compatible=False,
        )


@router.get("/{connection_id}/models", response_model=list[str])
def discover_connection_models(
    connection_id: Annotated[str, Path(pattern=r"^conn_[0-9a-f]{16,32}$")],
    request: Request,
) -> list[str]:
    """Discover available models on the target connection without sending prompts."""
    conn = request.app.state.db.get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})

    target_cfg = TargetConfig(
        provider=conn["provider"],
        model=_discovery_model(conn["model"]),
        base_url=conn["base_url"],
        api_key=conn["api_key"],
    )
    adapter = AdapterRegistry.create_adapter(request.app.state.settings, target_cfg, connection_data=None)
    check = adapter.check_connection(timeout_seconds=10.0)
    if not check.reachable:
        raise HTTPException(status_code=502, detail={
            "code": "model_discovery_failed",
            "message": check.error_message or "Could not reach the provider model catalog.",
        })
    if check.error_message and (
        "authentication" in check.error_message.lower()
        or ("invalid" in check.error_message.lower() and "key" in check.error_message.lower())
    ):
        raise HTTPException(status_code=401, detail={
            "code": "authentication_failed",
            "message": check.error_message,
        })
    if check.error_message:
        raise HTTPException(status_code=502, detail={
            "code": "model_discovery_failed",
            "message": check.error_message,
        })
    return sorted(set(check.discovered_models))


@router.post("/verify-live", response_model=ConnectionLiveVerifyResponse)
def verify_live_connection(body: ConnectionLiveVerifyRequest, request: Request) -> ConnectionLiveVerifyResponse:
    """Execute type-aware verification of a target or saved connection:
    1. Resolve connection and credentials securely.
    2. Check endpoint reachability and discover models.
    3. Run a chat/vision security audit or a non-chat contract probe.
    4. Return live metrics without conflating execution, contract, and safety status.
    """
    conn_data = None
    if body.connection_id:
        conn_data = request.app.state.db.get_connection(body.connection_id)
        if not conn_data:
            raise HTTPException(status_code=404, detail={"code": "connection_not_found", "message": "Connection not found."})

    target_cfg = body.target or TargetConfig()
    provider = (target_cfg.provider or (conn_data.get("provider") if conn_data else None) or "mock").lower()
    model = body.model_override or target_cfg.model or (conn_data.get("model") if conn_data else None) or "default"
    base_url = target_cfg.base_url or (conn_data.get("base_url") if conn_data else None)
    api_key = target_cfg.api_key or (conn_data.get("api_key") if conn_data else None)
    fallback_model = body.fallback_model or target_cfg.fallback_model or (conn_data.get("fallback_model") if conn_data else None)
    if body.model_type is not None:
        model_type = body.model_type
    elif body.target is not None and "model_type" in body.target.model_fields_set:
        model_type = body.target.model_type
    elif conn_data:
        model_type = ModelType(conn_data.get("model_type", ModelType.chat.value))
    else:
        model_type = ModelType.chat
    effective_test_id = (
        "multimodal-image-canary"
        if model_type == ModelType.vision and body.test_id == "canary-disclosure"
        else body.test_id
    )

    log_live_verification_started(
        connection_id=body.connection_id,
        provider=provider,
        model=model,
        test_id=effective_test_id,
    )

    resolved_target = TargetConfig(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        fallback_model=fallback_model,
        model_type=model_type,
        connection_id=body.connection_id,
        mock_behavior=target_cfg.mock_behavior,
        temperature=target_cfg.temperature,
        timeout_seconds=target_cfg.timeout_seconds,
        custom_headers=target_cfg.custom_headers or (conn_data.get("custom_headers") if conn_data else None),
        request_template=target_cfg.request_template or (conn_data.get("request_template") if conn_data else None),
        response_path=target_cfg.response_path or (conn_data.get("response_path") if conn_data else None),
    )

    try:
        adapter = AdapterRegistry.create_adapter(
            request.app.state.settings,
            resolved_target,
            connection_data=conn_data,
        )
        check = adapter.check_connection(timeout_seconds=5.0)
    except Exception as exc:
        clean_msg = sanitize_secrets_from_text(str(exc))
        return ConnectionLiveVerifyResponse(
            connection_id=body.connection_id,
            provider=provider,
            model=model,
            reachable=False,
            model_available=False,
            discovered_models=[],
            inference_executed=False,
            error_message=f"Connection check error: {clean_msg}",
            error_kind="connection",
            http_status=None,
            model_type=model_type,
            verification_kind="contract_probe" if model_type not in (ModelType.chat, ModelType.vision) else "security_audit",
            verification_status="ERROR",
        )

    blocking_check_error = bool(
        not check.reachable
        or (check.error_message and "authentication" in check.error_message.lower())
    )
    if blocking_check_error:
        clean_msg = sanitize_secrets_from_text(check.error_message or "Connection not reachable.")
        lower_msg = clean_msg.lower()
        err_kind = (
            "authentication" if "authentication" in lower_msg
            else "model_not_found" if not check.model_available and check.reachable
            else "connection"
        )
        http_code = None
        status_match = re.search(r"\bHTTP\s+(\d{3})\b", clean_msg, re.IGNORECASE)
        if status_match:
            http_code = int(status_match.group(1))
        return ConnectionLiveVerifyResponse(
            connection_id=body.connection_id,
            provider=provider,
            model=model,
            reachable=check.reachable,
            model_available=check.model_available,
            discovered_models=list(check.discovered_models),
            inference_executed=False,
            error_message=clean_msg,
            error_kind=err_kind,
            http_status=http_code,
            model_type=model_type,
            verification_kind="contract_probe" if model_type not in (ModelType.chat, ModelType.vision) else "security_audit",
            verification_status="ERROR",
        )

    # Non-chat models have different contracts and must never receive chat canary prompts.
    if model_type not in (ModelType.chat, ModelType.vision):
        if not base_url:
            return ConnectionLiveVerifyResponse(
                connection_id=body.connection_id, provider=provider, model=model,
                reachable=True, model_available=check.model_available,
                discovered_models=list(check.discovered_models), inference_executed=False,
                error_message="A base URL is required for this model type.", error_kind="configuration",
                model_type=model_type, verification_kind="contract_probe", verification_status="ERROR",
            )
        is_local_provider = provider in {"ollama", "vllm", "llamacpp", "transformers"}
        probe_timeout = resolved_target.timeout_seconds or (
            request.app.state.settings.inference_timeout_seconds
            if is_local_provider
            else request.app.state.settings.contract_probe_timeout_seconds
        )
        probe = probe_model(
            model_type=model_type,
            base_url=base_url,
            model=model,
            api_key=api_key,
            custom_headers=resolved_target.custom_headers,
            request_template=resolved_target.request_template,
            response_path=resolved_target.response_path,
            timeout_seconds=probe_timeout,
            allow_localhost=is_local_provider,
            allow_private=False,
        )
        probe_status = (
            "PASS" if probe.ok
            else "FAIL" if probe.error_kind == "invalid_response"
            else "ERROR"
        )
        return ConnectionLiveVerifyResponse(
            connection_id=body.connection_id,
            provider=provider,
            model=model,
            reachable=True,
            model_available=True if probe.ok else check.model_available,
            discovered_models=list(check.discovered_models),
            inference_executed=probe.ok,
            observed_latency_ms=probe.latency_ms,
            explanation=(f"{model_type.value.replace('_', ' ').title()} contract verified successfully."
                         if probe.ok else probe.error_message),
            error_message=probe.error_message,
            error_kind=probe.error_kind,
            http_status=probe.http_status,
            model_type=model_type,
            verification_kind="contract_probe",
            verification_status=probe_status,
            verification_details=probe.details,
        )

    # Reachability passed; now execute real inference and security evaluation
    run_rec = request.app.state.runner.run(RunRequest(test_id=effective_test_id, target=resolved_target))

    tokens = None
    if run_rec.result and run_rec.result.token_usage:
        tokens = TokenUsageSummary(
            prompt_tokens=run_rec.result.token_usage.prompt_tokens,
            completion_tokens=run_rec.result.token_usage.completion_tokens,
            total_tokens=run_rec.result.token_usage.total_tokens,
        )

    is_error = bool(run_rec.result and run_rec.result.status in (TestStatus.ERROR, TestStatus.UNSUPPORTED))
    error_kind: str | None = None
    error_msg: str | None = None
    http_status: int | None = None

    if is_error:
        for ev in run_rec.evidence:
            if ev.kind == "target_error":
                if ": " in ev.content:
                    extracted_kind, extracted_msg = ev.content.split(": ", 1)
                    error_kind = extracted_kind.strip()
                    error_msg = extracted_msg.strip()
                else:
                    error_msg = ev.content.strip()
                break

        if not error_msg and run_rec.result:
            error_msg = run_rec.result.explanation

        if error_msg:
            status_match = re.search(r"\bHTTP\s+(\d{3})\b", error_msg, re.IGNORECASE)
            if status_match:
                http_status = int(status_match.group(1))

        if not error_kind and run_rec.result:
            for ind in run_rec.result.matched_indicators:
                if ind.startswith("target_") and ind != "target_http_error":
                    error_kind = ind.removeprefix("target_")
                    break

        if http_status is None:
            if error_kind == "server_overload":
                http_status = 503
            elif error_kind == "rate_limit":
                http_status = 429
            elif error_kind == "model_not_found":
                http_status = 404
            elif error_kind == "authentication":
                http_status = 401

    case = request.app.state.registry.get(effective_test_id)
    case_input = case.build_input() if case else None
    raw_run = request.app.state.db.get_raw(run_rec.run_id) if run_rec.run_id else None
    output_preview = raw_run.executions[0].output_text if (raw_run and raw_run.executions) else None

    log_live_verification_audit(
        connection_id=body.connection_id,
        provider=provider,
        model=run_rec.target.model or model,
        test_id=effective_test_id,
        test_name=case.name if case else effective_test_id,
        system_prompt=case_input.system_prompt if case_input else "",
        user_prompt=case_input.user_prompt if case_input else "",
        verdict=run_rec.result.status.value if run_rec.result and run_rec.result.status else ("ERROR" if is_error else "UNKNOWN"),
        explanation=run_rec.result.explanation if run_rec.result else (error_msg or "Execution completed"),
        rule_id=run_rec.result.rule_id if run_rec.result else "N/A",
        rule_version=run_rec.result.rule_version if run_rec.result else "1.0.0",
        matched_indicators=list(run_rec.result.matched_indicators) if run_rec.result else [],
        latency_ms=run_rec.result.observed_latency_ms if run_rec.result else None,
        token_usage=tokens.model_dump() if tokens else None,
        output_preview=output_preview,
        fallback_used=bool(run_rec.target and run_rec.target.model != model),
        error=error_msg,
    )

    security_status = (
        "ERROR" if is_error
        else "FAIL" if run_rec.result and run_rec.result.status == TestStatus.FAIL
        else "PASS" if run_rec.result and run_rec.result.status == TestStatus.PASS
        else None
    )

    return ConnectionLiveVerifyResponse(
        connection_id=body.connection_id,
        provider=provider,
        model=run_rec.target.model or model,
        reachable=check.reachable,
        model_available=check.model_available,
        discovered_models=list(check.discovered_models),
        inference_executed=not is_error,
        run_id=run_rec.run_id,
        verdict=run_rec.result.status if run_rec.result else None,
        observed_latency_ms=run_rec.result.observed_latency_ms if run_rec.result else None,
        token_usage=tokens,
        explanation=run_rec.result.explanation if run_rec.result else None,
        error_message=error_msg,
        error_kind=error_kind,
        http_status=http_status,
        model_type=model_type,
        verification_kind="security_audit",
        verification_status=security_status,
    )


@router.post("/{connection_id}/verify-live", response_model=ConnectionLiveVerifyResponse)
def verify_saved_connection_live(
    connection_id: Annotated[str, Path(pattern=r"^conn_[0-9a-f]{16,32}$")],
    request: Request,
    body: ConnectionLiveVerifyRequest | None = None,
) -> ConnectionLiveVerifyResponse:
    req = body or ConnectionLiveVerifyRequest()
    req.connection_id = connection_id
    return verify_live_connection(req, request)
