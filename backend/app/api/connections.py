"""API endpoints for model connections, provider discovery, and connection checks.

Enforces security controls:
- Secrets are never returned over API endpoints.
- SSRF protections are enforced on custom endpoints.
- Model discovery does not execute adversarial prompts.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request

from app.schemas import (
    ConnectionId,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ModelCapabilitiesSchema,
    ProviderMetaResponse,
    SavedConnectionCreate,
    SavedConnectionListResponse,
    SavedConnectionResponse,
    SavedConnectionUpdate,
    TargetConfig,
)
from app.services.model_adapter import ConnectionCheckResult
from app.services.adapter_registry import SUPPORTED_PROVIDERS_META, AdapterRegistry

logger = logging.getLogger("safebox.api.connections")
router = APIRouter(prefix="/api/connections", tags=["connections"])


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
    )
    logger.info("Saved connection created id=%s name=%s provider=%s", resp.connection_id, resp.name, resp.provider)
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
    api_key = body.api_key if body.api_key is not None else existing["api_key"]
    custom_headers = body.custom_headers if body.custom_headers is not None else existing["custom_headers"]
    request_template = body.request_template if body.request_template is not None else existing["request_template"]
    response_path = body.response_path if body.response_path is not None else existing["response_path"]

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
    )
    logger.info("Saved connection updated id=%s", connection_id)
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

    target_cfg = TargetConfig(
        provider=body.provider or (conn_data.get("provider") if conn_data else None),
        model=body.model or (conn_data.get("model") if conn_data else None),
        base_url=body.base_url or (conn_data.get("base_url") if conn_data else None),
        api_key=body.api_key or (conn_data.get("api_key") if conn_data else None),
    )

    try:
        adapter = AdapterRegistry.create_adapter(
            request.app.state.settings,
            target_cfg,
            connection_data=conn_data,
        )
        res = adapter.check_connection(timeout_seconds=5.0)
        caps = ModelCapabilitiesSchema(**res.capabilities.to_dict()) if res.capabilities else None
        return ConnectionTestResponse(
            reachable=res.reachable,
            model_available=res.model_available,
            latency_ms=res.latency_ms,
            capabilities=caps,
            discovered_models=list(res.discovered_models),
            error_message=res.error_message,
        )
    except Exception as exc:
        return ConnectionTestResponse(
            reachable=False,
            model_available=False,
            error_message=f"Connection test failed: {exc}",
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
        model=conn["model"],
        base_url=conn["base_url"],
        api_key=conn["api_key"],
    )
    adapter = AdapterRegistry.create_adapter(request.app.state.settings, target_cfg, connection_data=conn)
    return adapter.discover_models(timeout_seconds=5.0)
