"""API endpoints for viewing backend activity, audit logs, and inspection details."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel

from app.services.activity_logger import ActivityLogger

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])


class ActivityLogEntry(BaseModel):
    id: str
    timestamp: str
    display_time: str
    action: str
    title: str
    status: str
    steps: list[str]
    metadata: dict[str, Any]
    prompts: dict[str, str]
    evaluation: dict[str, Any]


class ActivityLogResponse(BaseModel):
    events: list[ActivityLogEntry]
    total: int


@router.get("", response_model=ActivityLogResponse)
def get_activity_logs(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    action: Annotated[str | None, Query()] = None,
) -> ActivityLogResponse:
    """Retrieve recent backend activity and security audit events."""
    logger_inst = ActivityLogger.get_instance()
    events = logger_inst.get_recent_events(limit=limit, action_filter=action)
    return ActivityLogResponse(
        events=[ActivityLogEntry(**e) for e in events],
        total=len(events),
    )


@router.get("/file", response_class=Response)
def get_activity_log_file(lines: Annotated[int, Query(ge=10, le=1000)] = 100) -> Response:
    """Read the tail of the persistent activity log file."""
    logger_inst = ActivityLogger.get_instance()
    if not logger_inst.log_file.exists():
        return Response(content="No activity recorded yet.", media_type="text/plain")

    try:
        with open(logger_inst.log_file, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        tail = "".join(all_lines[-lines:])
        return Response(content=tail, media_type="text/plain")
    except Exception as exc:
        return Response(content=f"Error reading activity log: {exc}", media_type="text/plain", status_code=500)


@router.delete("", status_code=204)
def clear_activity_logs() -> None:
    """Clear in-memory activity log history."""
    ActivityLogger.get_instance().clear_history()
