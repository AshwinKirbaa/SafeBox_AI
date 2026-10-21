"""Base class for infrastructure isolation checks."""

from abc import ABC, abstractmethod
from typing import Any
from ..models import IsolationCheckResult


class BaseIsolationCheck(ABC):
    check_id: str
    policy_id: str
    policy_version: str = "1.0.0"

    @abstractmethod
    def run(self, context: dict[str, Any]) -> IsolationCheckResult:
        """Execute the check and return structured result."""
        pass
