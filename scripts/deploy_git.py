"""Shared helper for VM deploy scripts: SHA of the local tree being uploaded.

Passed as GIT_COMMIT to `docker compose build api` so GET /api/v1/health reports it.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def local_git_commit() -> str:
    """Short SHA of HEAD, suffixed -dirty when the working tree has uncommitted changes."""
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
        ).strip()
        dirty = subprocess.run(["git", "diff", "--quiet", "HEAD"], cwd=ROOT).returncode != 0
        return f"{sha}-dirty" if dirty else sha
    except Exception:
        return "unknown"
