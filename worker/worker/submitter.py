"""HTTP client for submitting infrastructure check results to Member 1 backend."""

import logging
from collections.abc import Callable
from typing import Any
import httpx
from .models import InfraCheckSubmission

logger = logging.getLogger("safebox.worker.submitter")


class InfraSubmitter:
    def __init__(
        self,
        backend_url: str = "http://127.0.0.1:8000",
        token: str | None = None,
        timeout: float = 10.0,
        submit_fn: Callable[[InfraCheckSubmission], dict[str, Any]] | None = None,
    ):
        self.backend_url = backend_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self.submit_fn = submit_fn

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Worker-Token"] = self.token
        return headers

    def submit_one(self, submission: InfraCheckSubmission) -> dict[str, Any]:
        """Submit a single check to SafeBox Member 1 backend."""
        if self.submit_fn is not None:
            return self.submit_fn(submission)

        url = f"{self.backend_url}/api/security-tests/runs/{submission.run_id}/infrastructure-checks"
        payload = submission.model_dump(exclude_none=True)
        headers = self._headers()

        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload, headers=headers)

        if resp.status_code == 201:
            return {"status": "created", "data": resp.json(), "check_id": submission.check_id}
        elif resp.status_code == 409:
            return {"status": "duplicate", "error": resp.json(), "check_id": submission.check_id}
        else:
            resp.raise_for_status()
            return {"status": "unknown", "data": resp.json()}

    def submit_all(self, submissions: list[InfraCheckSubmission]) -> list[dict[str, Any]]:
        """Submit all checks in sequence."""
        results = []
        for sub in submissions:
            try:
                res = self.submit_one(sub)
                results.append(res)
            except Exception as e:
                results.append({
                    "status": "failed",
                    "check_id": sub.check_id,
                    "error": str(e),
                })
        return results
