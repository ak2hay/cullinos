"""Shared helper for VM deploy scripts: SHA of the local tree being uploaded.

Passed as GIT_COMMIT to `docker compose build api` so GET /api/v1/health reports it.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _rev(args: list[str]) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def local_git_commit() -> str:
    """First 7 hex chars of HEAD, suffixed -dirty when the tree is not a clean commit.

    Fixed width (not `git rev-parse --short`, which grows on collisions) so the
    value baked into the image matches what this script expects from /health.
    """
    try:
        full = local_git_sha()
        if len(full) < 7:
            return "unknown"
        short = full[:7]
        dirty = subprocess.run(["git", "diff", "--quiet", "HEAD"], cwd=ROOT).returncode != 0
        untracked = _rev(["git", "ls-files", "--others", "--exclude-standard"])
        if dirty or untracked:
            return f"{short}-dirty"
        return short
    except Exception:
        return "unknown"


def local_git_sha() -> str:
    """Full HEAD sha, or empty when git is unavailable."""
    try:
        return _rev(["git", "rev-parse", "HEAD"])
    except Exception:
        return ""


def changed_files_since(base: str) -> list[str]:
    """Paths that differ between base and the working tree (committed, staged, untracked)."""

    def names(args: list[str]) -> list[str]:
        return [line.strip() for line in _rev(args).splitlines() if line.strip()]

    files: set[str] = set()
    files.update(names(["git", "diff", "--name-only", base, "HEAD"]))
    files.update(names(["git", "diff", "--name-only", "HEAD"]))
    files.update(names(["git", "ls-files", "--others", "--exclude-standard"]))
    return sorted(files)


def resolve_commit(sha: str) -> str:
    """Return the full sha if this clone contains it."""
    return _rev(["git", "rev-parse", "--verify", f"{sha}^{{commit}}"])
