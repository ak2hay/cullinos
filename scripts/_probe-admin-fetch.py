#!/usr/bin/env python3
"""Probe admin SPA baked API URL + org endpoint CORS."""
from __future__ import annotations

import re
import urllib.error
import urllib.request


def main() -> None:
    html = urllib.request.urlopen("https://admin.cullinos.com/", timeout=15).read().decode()
    assets = re.findall(r'src="(/assets/[^"]+)"', html)
    print("html assets:", assets)
    for a in assets[:5]:
        data = (
            urllib.request.urlopen(f"https://admin.cullinos.com{a}", timeout=30)
            .read()
            .decode("utf-8", "replace")
        )
        urls = sorted(set(re.findall(r"https?://[A-Za-z0-9._:/-]*cullinos[A-Za-z0-9._:/-]*", data)))
        print(a, "len", len(data))
        for u in urls:
            print(" ", u)
        if "api.cullinos.com" not in data:
            # also check relative /api
            if "/api/v1" in data:
                print("  contains /api/v1 relative paths")
            else:
                print("  WARNING: no api.cullinos.com in bundle")

    # OPTIONS preflight for organizations/current
    req = urllib.request.Request(
        "https://api.cullinos.com/api/v1/organizations/current",
        method="OPTIONS",
        headers={
            "Origin": "https://admin.cullinos.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            print("OPTIONS status", r.status)
            for h in [
                "Access-Control-Allow-Origin",
                "Access-Control-Allow-Headers",
                "Access-Control-Allow-Methods",
                "Access-Control-Allow-Credentials",
            ]:
                print(h, r.headers.get(h))
    except urllib.error.HTTPError as e:
        print("OPTIONS HTTPError", e.code)
        for h in [
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Headers",
            "Access-Control-Allow-Methods",
        ]:
            print(h, e.headers.get(h) if e.headers else None)
        print(e.read()[:500])

    # unauth GET should 401 with CORS headers
    req2 = urllib.request.Request(
        "https://api.cullinos.com/api/v1/organizations/current",
        headers={"Origin": "https://admin.cullinos.com"},
    )
    try:
        with urllib.request.urlopen(req2, timeout=15) as r:
            print("GET status", r.status, "ACA", r.headers.get("Access-Control-Allow-Origin"))
    except urllib.error.HTTPError as e:
        print("GET HTTPError", e.code, "ACA", e.headers.get("Access-Control-Allow-Origin"))
        print(e.read()[:300])


if __name__ == "__main__":
    main()
