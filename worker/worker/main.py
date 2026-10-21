"""CLI entry point for Member 2 Sandbox Worker."""

import argparse
import json
import os
import sys
from .config import get_config
from .runner import IsolationCheckRunner
from .submitter import InfraSubmitter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SafeBox AI Member 2 Sandbox Worker")
    parser.add_argument("--run-id", required=False, help="Run ID to associate checks with (e.g. run_0123...)")
    parser.add_argument("--worker-id", default=os.getenv("SAFEBOX_WORKER_ID", "worker-1"), help="Worker ID")
    parser.add_argument("--backend-url", default=os.getenv("SAFEBOX_BACKEND_URL", "http://127.0.0.1:8000"), help="SafeBox backend URL")
    parser.add_argument("--token", default=os.getenv("SAFEBOX_WORKER_TOKEN"), help="Worker authentication token")
    parser.add_argument("--workspace-dir", default=os.getenv("SAFEBOX_WORKSPACE_DIR", "/workspace"), help="Path to current workspace")
    parser.add_argument("--adjacent-dir", default=os.getenv("SAFEBOX_ADJACENT_DIR"), help="Path to adjacent workspace for negative testing")
    parser.add_argument("--submit", action="store_true", help="Submit results to SafeBox backend")
    parser.add_argument("--json", action="store_true", help="Print results as JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    context = {
        "workspace_dir": args.workspace_dir,
        "adjacent_workspace_dir": args.adjacent_dir,
    }

    runner = IsolationCheckRunner()

    if args.run_id and args.submit:
        results, submissions = runner.run_and_prepare_submissions(
            worker_id=args.worker_id, run_id=args.run_id, context=context
        )
        submitter = InfraSubmitter(backend_url=args.backend_url, token=args.token)
        submission_reports = submitter.submit_all(submissions)

        out = {
            "worker_id": args.worker_id,
            "run_id": args.run_id,
            "checks": [r.model_dump() for r in results],
            "submissions": submission_reports,
        }
        if args.json:
            print(json.dumps(out, indent=2))
        else:
            print(f"SafeBox Worker [{args.worker_id}] executed {len(results)} checks for run {args.run_id}")
            for r in results:
                print(f"  [{r.status.value:^12}] {r.check_id}: {r.observed}")
            print(f"Submitted to {args.backend_url}: {len(submission_reports)} submissions.")
        return 0
    else:
        results = runner.run_all(context)
        out = {
            "worker_id": args.worker_id,
            "run_id": args.run_id,
            "checks": [r.model_dump() for r in results],
        }
        if args.json:
            print(json.dumps(out, indent=2))
        else:
            print(f"SafeBox Worker [{args.worker_id}] local check results:")
            for r in results:
                print(f"  [{r.status.value:^12}] {r.check_id}: {r.observed}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
