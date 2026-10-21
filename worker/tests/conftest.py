"""Test fixtures for worker test suite."""

import sys
from pathlib import Path
import pytest

# Ensure worker package is on sys.path
worker_dir = Path(__file__).resolve().parent.parent
if str(worker_dir) not in sys.path:
    sys.path.insert(0, str(worker_dir))

# Ensure backend package is on sys.path for end-to-end contract validation
backend_dir = worker_dir.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
