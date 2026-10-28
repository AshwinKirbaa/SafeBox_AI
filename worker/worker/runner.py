"""Executes isolation checks and produces structured results."""

import time
from typing import Any, Type
from .checks import ALL_CHECKS, BaseIsolationCheck
from .models import CheckStatus, InfraCheckSubmission, IsolationCheckResult


class IsolationCheckRunner:
    def __init__(self, check_classes: list[Type[BaseIsolationCheck]] | None = None):
        self.check_classes = check_classes or ALL_CHECKS

    def run_all(self, context: dict[str, Any]) -> list[IsolationCheckResult]:
        results: list[IsolationCheckResult] = []
        for cls in self.check_classes:
            check_inst = cls()
            started = time.perf_counter()
            try:
                res = check_inst.run(context)
            except Exception as e:
                res = IsolationCheckResult(
                    check_id=check_inst.check_id,
                    policy_id=check_inst.policy_id,
                    policy_version=check_inst.policy_version,
                    status=CheckStatus.ERROR,
                    expected="successful check execution",
                    observed="unhandled exception in check",
                    error=f"Exception executing {check_inst.check_id}: {e}",
                )
            res.duration_ms = max(0, round((time.perf_counter() - started) * 1000))
            results.append(res)
        return results

    def run_and_prepare_submissions(
        self, worker_id: str, run_id: str, context: dict[str, Any]
    ) -> tuple[list[IsolationCheckResult], list[InfraCheckSubmission]]:
        results = self.run_all(context)
        submissions = [r.to_submission(worker_id=worker_id, run_id=run_id) for r in results]
        return results, submissions
