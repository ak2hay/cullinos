#!/usr/bin/env python3
"""Point the API nginx upstream at 3000 or 3001 and back.

Used by scripts/prod/roll-api.sh so a new container can take traffic before
the Compose service rebinds 127.0.0.1:3000. Only the upstream server line and
a direct proxy_pass to that loopback port are rewritten. proxy_pass to the
upstream name (http://cullinos_api) is left alone.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Only the API listener. 5180 is the marketing site and must stay put.
UPSTREAM = re.compile(
    r"(upstream\s+cullinos_api\s*\{[^}]*?server\s+127\.0\.0\.1:)300[01]\b"
)
PROXY = re.compile(r"(proxy_pass\s+http://127\.0\.0\.1:)300[01]\b")


def rewrite(text: str, port: str) -> tuple[str, int]:
    if port not in {"3000", "3001"}:
        raise ValueError("port must be 3000 or 3001")
    updated, upstream_hits = UPSTREAM.subn(rf"\g<1>{port}", text)
    updated, proxy_hits = PROXY.subn(rf"\g<1>{port}", updated)
    return updated, upstream_hits + proxy_hits


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) < 2:
        print("usage: nginx_roll.py <3000|3001> <conf> [conf...]", file=sys.stderr)
        return 2
    port, paths = args[0], args[1:]
    changed = 0
    for raw in paths:
        file = Path(raw)
        text = file.read_text(encoding="utf-8")
        updated, hits = rewrite(text, port)
        if hits:
            file.write_text(updated, encoding="utf-8")
            changed += 1
    if changed == 0:
        print("no API upstream line found", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
