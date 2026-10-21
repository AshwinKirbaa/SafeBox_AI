"""Isolation checks registry."""

from typing import Type
from .base import BaseIsolationCheck
from .docker_socket import DockerSocketCheck
from .user_privileges import UserPrivilegesCheck
from .dropped_capabilities import DroppedCapabilitiesCheck
from .resource_limits import ResourceLimitsCheck
from .workspace_isolation import WorkspaceIsolationCheck
from .host_filesystem import HostFilesystemProtectionCheck
from .network_egress import NetworkEgressCheck

ALL_CHECKS: list[Type[BaseIsolationCheck]] = [
    DockerSocketCheck,
    UserPrivilegesCheck,
    DroppedCapabilitiesCheck,
    ResourceLimitsCheck,
    WorkspaceIsolationCheck,
    HostFilesystemProtectionCheck,
    NetworkEgressCheck,
]

__all__ = [
    "BaseIsolationCheck",
    "DockerSocketCheck",
    "UserPrivilegesCheck",
    "DroppedCapabilitiesCheck",
    "ResourceLimitsCheck",
    "WorkspaceIsolationCheck",
    "HostFilesystemProtectionCheck",
    "NetworkEgressCheck",
    "ALL_CHECKS",
]
