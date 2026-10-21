from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .docker_runner import DockerSandboxOrchestrator


def __getattr__(name: str):
    if name == "DockerSandboxOrchestrator":
        from .docker_runner import DockerSandboxOrchestrator

        return DockerSandboxOrchestrator
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["DockerSandboxOrchestrator"]
