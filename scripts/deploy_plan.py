#!/usr/bin/env python3
"""Decide what a routine Cullinos release needs to ship.

Pure function of a git diff plus flags. No SSH, no Docker. The fast-deploy
script and the Images workflow both call this so they stay in agreement.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field

# Vite apps published under /var/www/cullinos. guest-web replaces guest-landing.
SPA_APPS: tuple[str, ...] = (
    "admin",
    "management",
    "super-admin",
    "app-ops",
    "pos",
    "kds",
    "kiosk",
    "guest-web",
)

SPA_PUBLISH: dict[str, str] = {
    "admin": "admin",
    "management": "management",
    "super-admin": "super-admin",
    "app-ops": "app-ops",
    "pos": "pos",
    "kds": "kds",
    "kiosk": "kiosk",
    "guest-web": "guest-landing",
}

# Workspace packages compiled into the API image (see npm run build:api).
API_PACKAGE_PREFIXES: tuple[str, ...] = (
    "packages/shared/",
    "packages/auth/",
    "packages/events/",
    "packages/integrations/",
    "packages/menu-catalog/",
    "packages/prisma/",
    "packages/sync/",
    "packages/tax-engine/",
    "packages/ai-contracts/",
)

LOCKFILES = ("package.json", "package-lock.json", ".npmrc")
MIGRATION_PREFIX = "packages/prisma/prisma/migrations/"
FRONTEND_NGINX = "infrastructure/nginx/cullinos-frontends.conf"
API_NGINX = "infrastructure/nginx/api.cullinos.com.conf"
WAITER_LANDING_PREFIX = "infrastructure/www/waiter-landing/"
GUEST_LANDING_PREFIX = "infrastructure/www/guest-landing/"


@dataclass
class ReleasePlan:
    """What to build, ship, and restart. Empty means the commit has no VM effect."""

    api_image: bool = False
    api_recreate: bool = False
    web_image: bool = False
    web_recreate: bool = False
    spas: list[str] = field(default_factory=list)
    landings: list[str] = field(default_factory=list)
    migrate: bool = False
    nginx_frontends: bool = False
    sync_runtime_files: bool = False
    notes: list[str] = field(default_factory=list)

    def anything(self) -> bool:
        return bool(
            self.api_image
            or self.api_recreate
            or self.web_image
            or self.web_recreate
            or self.spas
            or self.landings
            or self.migrate
            or self.nginx_frontends
            or self.sync_runtime_files
        )

    def summary_lines(self) -> list[str]:
        lines = [
            f"api image: {'yes' if self.api_image else 'no'}"
            + (" (recreate)" if self.api_recreate else ""),
            f"web image: {'yes' if self.web_image else 'no'}"
            + (" (recreate)" if self.web_recreate else ""),
            "spas: " + (", ".join(self.spas) if self.spas else "none"),
            "landings: " + (", ".join(self.landings) if self.landings else "none"),
            f"migrate: {'yes' if self.migrate else 'no'}",
            f"nginx frontends: {'yes' if self.nginx_frontends else 'no'}",
            f"sync compose + scripts/prod: {'yes' if self.sync_runtime_files else 'no'}",
        ]
        lines.extend(f"note: {note}" for note in self.notes)
        return lines


def _norm(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def _matches(path: str, prefix_or_file: str) -> bool:
    if prefix_or_file.endswith("/"):
        return path.startswith(prefix_or_file)
    return path == prefix_or_file


def _any(files: list[str], *needles: str) -> bool:
    return any(_matches(path, needle) for path in files for needle in needles)


def plan_release(
    files: list[str] | None,
    *,
    scope: str = "auto",
    apps: list[str] | None = None,
    include_web: bool = False,
    migrate: str = "auto",
    nginx: str = "auto",
    base_known: bool = True,
) -> ReleasePlan:
    """Build a release plan.

    scope: auto | all | api | frontends | web
    migrate / nginx: auto | always | never
    base_known: False forces a full ship when scope is auto (health SHA missing).
    """
    if scope not in {"auto", "all", "api", "frontends", "web"}:
        raise ValueError(f"unknown scope {scope}")
    if migrate not in {"auto", "always", "never"}:
        raise ValueError(f"unknown migrate mode {migrate}")
    if nginx not in {"auto", "always", "never"}:
        raise ValueError(f"unknown nginx mode {nginx}")

    requested = list(apps or [])
    unknown = [name for name in requested if name not in SPA_APPS]
    if unknown:
        raise ValueError(f"unknown app(s): {', '.join(unknown)}")

    plan = ReleasePlan()
    changed = [_norm(path) for path in (files or []) if path.strip()]

    if scope == "auto" and not base_known:
        plan.notes.append("Production commit is not in this clone; shipping everything.")
        scope = "all"
        changed = []

    if scope == "all":
        plan.api_image = True
        plan.api_recreate = True
        plan.web_image = True
        plan.web_recreate = True
        plan.spas = list(requested or SPA_APPS)
        plan.landings = ["waiter-landing"]
        plan.migrate = migrate != "never"
        plan.nginx_frontends = nginx != "never"
        plan.sync_runtime_files = True
        if include_web:
            plan.notes.append("--web is already included by --all.")
        return plan

    if scope == "api":
        plan.api_image = True
        plan.api_recreate = True
        plan.migrate = migrate == "always" or (
            migrate == "auto" and _any(changed, MIGRATION_PREFIX)
        )
        plan.sync_runtime_files = True
        plan.nginx_frontends = nginx == "always"
        return plan

    if scope == "web":
        plan.web_image = True
        plan.web_recreate = True
        plan.sync_runtime_files = True
        plan.nginx_frontends = nginx == "always"
        plan.migrate = migrate == "always"
        return plan

    if scope == "frontends":
        plan.spas = list(requested or SPA_APPS)
        plan.landings = ["waiter-landing"]
        if "guest-web" in plan.spas or _any(changed, GUEST_LANDING_PREFIX):
            if "guest-web" not in plan.spas:
                plan.spas.append("guest-web")
        plan.web_image = include_web
        plan.web_recreate = include_web
        plan.sync_runtime_files = include_web
        plan.nginx_frontends = nginx == "always" or (
            nginx == "auto" and _any(changed, FRONTEND_NGINX)
        )
        plan.migrate = migrate == "always"
        return plan

    # scope == auto
    lock = _any(changed, *LOCKFILES)
    base_ts = _any(changed, "tsconfig.base.json")
    compose = _any(changed, "docker-compose.prod.yml")
    shared = _any(changed, "packages/shared/")
    ui = _any(changed, "packages/ui/")

    plan.api_image = lock or base_ts or _any(
        changed,
        "Dockerfile",
        "index.js",
        "apps/api/",
        *API_PACKAGE_PREFIXES,
    )
    plan.web_image = lock or base_ts or shared or ui or _any(changed, "Dockerfile.web", "apps/web/")

    if shared or ui or lock or base_ts or _any(changed, "turbo.json"):
        plan.spas = list(SPA_APPS)
    else:
        for app in SPA_APPS:
            if _any(changed, f"apps/{app}/"):
                plan.spas.append(app)

    if _any(changed, GUEST_LANDING_PREFIX) and "guest-web" not in plan.spas:
        plan.spas.append("guest-web")
        plan.notes.append("guest-landing assetlinks changed; republishing guest-web.")

    if _any(changed, WAITER_LANDING_PREFIX):
        plan.landings.append("waiter-landing")

    if requested:
        plan.spas = [app for app in plan.spas if app in requested]
        if not _any(changed, WAITER_LANDING_PREFIX):
            plan.landings = []

    plan.migrate = migrate == "always" or (migrate == "auto" and _any(changed, MIGRATION_PREFIX))
    if plan.migrate and not plan.api_image:
        # Migrations live inside the API image. Ship the image that contains them.
        plan.api_image = True
        plan.notes.append("Migration files changed; the API image carries them.")

    plan.api_recreate = plan.api_image or compose
    plan.web_recreate = plan.web_image or compose
    if compose and not plan.api_image and not plan.web_image:
        plan.notes.append("Compose file changed; recreating api and web without rebuilding images.")

    plan.nginx_frontends = nginx == "always" or (nginx == "auto" and _any(changed, FRONTEND_NGINX))
    if nginx == "never":
        plan.nginx_frontends = False

    if _any(changed, API_NGINX):
        plan.notes.append(
            "infrastructure/nginx/api.cullinos.com.conf changed. This command does not install it "
            "(certbot edits that file on the VM). Review it before copying."
        )

    plan.sync_runtime_files = bool(
        plan.api_recreate
        or plan.web_recreate
        or plan.nginx_frontends
        or _any(changed, "scripts/prod/", "docker-compose.prod.yml", "Dockerfile", "Dockerfile.web")
    )

    flutter = [path for path in changed if path.startswith(("apps/guest/", "apps/waiter_mobile/"))]
    if flutter and not plan.anything():
        plan.notes.append("Flutter app changes are not part of the VM release.")
    elif not plan.anything() and changed:
        plan.notes.append("No API, web, SPA, nginx, or migration changes in this diff.")

    if include_web:
        plan.web_image = True
        plan.web_recreate = True
        plan.sync_runtime_files = True

    return plan


def classify_images(files: list[str]) -> tuple[bool, bool]:
    """Return (api, web) for the GitHub Actions image build."""
    plan = plan_release(files, scope="auto", base_known=True)
    return plan.api_image, plan.web_image


def plan_json(plan: ReleasePlan) -> dict[str, object]:
    return {
        "api_image": plan.api_image,
        "api_recreate": plan.api_recreate,
        "web_image": plan.web_image,
        "web_recreate": plan.web_recreate,
        "spas": plan.spas,
        "landings": plan.landings,
        "migrate": plan.migrate,
        "nginx_frontends": plan.nginx_frontends,
        "sync_runtime_files": plan.sync_runtime_files,
        "notes": plan.notes,
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Plan a production release from a file list on stdin.")
    parser.add_argument("--classify", action="store_true", help="Print api=true/false and web=true/false.")
    parser.add_argument("--json", action="store_true", help="Print the release plan as JSON.")
    parser.add_argument("--scope", default="auto", choices=["auto", "all", "api", "frontends", "web"])
    parser.add_argument("--apps", default="", help="Comma-separated SPA names.")
    parser.add_argument("--web", action="store_true", help="Also ship the marketing image.")
    parser.add_argument("--migrate", default="auto", choices=["auto", "always", "never"])
    parser.add_argument("--nginx", default="auto", choices=["auto", "always", "never"])
    parser.add_argument("--unknown-base", action="store_true", help="Production SHA is unknown; ship everything when scope=auto.")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    files = [line.strip() for line in sys.stdin if line.strip()]
    if args.classify:
        api, web = classify_images(files)
        sys.stdout.write(f"api={'true' if api else 'false'}\nweb={'true' if web else 'false'}\n")
        return 0
    if not args.json:
        parser.error("pass --json or --classify")
    apps = [name.strip() for name in args.apps.split(",") if name.strip()]
    plan = plan_release(
        files,
        scope=args.scope,
        apps=apps,
        include_web=args.web,
        migrate=args.migrate,
        nginx=args.nginx,
        base_known=not args.unknown_base,
    )
    json.dump(plan_json(plan), sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
