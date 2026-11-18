#!/usr/bin/env python3
"""Unit tests for the routine-release planner. No third-party deps."""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import deploy_plan  # noqa: E402
from deploy_plan import SPA_APPS, plan_release  # noqa: E402


class PlanTests(unittest.TestCase):
    def test_admin_only(self) -> None:
        plan = plan_release(["apps/admin/src/App.tsx"])
        self.assertEqual(plan.spas, ["admin"])
        self.assertFalse(plan.api_image)
        self.assertFalse(plan.web_image)
        self.assertFalse(plan.migrate)
        self.assertFalse(plan.nginx_frontends)

    def test_api_source_skips_frontends_and_migrations(self) -> None:
        plan = plan_release(["apps/api/src/main.ts"])
        self.assertTrue(plan.api_image)
        self.assertTrue(plan.api_recreate)
        self.assertFalse(plan.web_image)
        self.assertEqual(plan.spas, [])
        self.assertFalse(plan.migrate)

    def test_shared_rebuilds_api_web_and_every_spa(self) -> None:
        plan = plan_release(["packages/shared/src/index.ts"])
        self.assertTrue(plan.api_image)
        self.assertTrue(plan.web_image)
        self.assertEqual(plan.spas, list(SPA_APPS))
        self.assertFalse(plan.migrate)

    def test_ui_does_not_rebuild_api(self) -> None:
        plan = plan_release(["packages/ui/src/index.ts"])
        self.assertFalse(plan.api_image)
        self.assertTrue(plan.web_image)
        self.assertEqual(plan.spas, list(SPA_APPS))

    def test_migration_ships_api_and_runs_migrate(self) -> None:
        plan = plan_release(["packages/prisma/prisma/migrations/20261118_add_x/migration.sql"])
        self.assertTrue(plan.api_image)
        self.assertTrue(plan.migrate)
        self.assertEqual(plan.spas, [])

    def test_prisma_source_without_migration_skips_migrate(self) -> None:
        plan = plan_release(["packages/prisma/src/index.ts"])
        self.assertTrue(plan.api_image)
        self.assertFalse(plan.migrate)

    def test_dockerfile_web_only(self) -> None:
        plan = plan_release(["Dockerfile.web"])
        self.assertTrue(plan.web_image)
        self.assertFalse(plan.api_image)
        self.assertEqual(plan.spas, [])

    def test_lockfile_rebuilds_images_and_spas(self) -> None:
        plan = plan_release(["package-lock.json"])
        self.assertTrue(plan.api_image)
        self.assertTrue(plan.web_image)
        self.assertEqual(plan.spas, list(SPA_APPS))

    def test_empty_diff(self) -> None:
        plan = plan_release([])
        self.assertFalse(plan.anything())

    def test_docs_only(self) -> None:
        plan = plan_release(["docs/DEPLOYMENT.md"])
        self.assertFalse(plan.anything())
        self.assertTrue(plan.notes)

    def test_nginx_frontends_does_not_rebuild_api(self) -> None:
        plan = plan_release(["infrastructure/nginx/cullinos-frontends.conf"])
        self.assertTrue(plan.nginx_frontends)
        self.assertFalse(plan.api_image)
        self.assertFalse(plan.web_image)

    def test_api_nginx_is_noted_not_installed(self) -> None:
        plan = plan_release(["infrastructure/nginx/api.cullinos.com.conf"])
        self.assertFalse(plan.nginx_frontends)
        self.assertTrue(any("certbot" in note for note in plan.notes))

    def test_waiter_landing(self) -> None:
        plan = plan_release(["infrastructure/www/waiter-landing/index.html"])
        self.assertEqual(plan.landings, ["waiter-landing"])
        self.assertEqual(plan.spas, [])

    def test_compose_recreates_without_image_build(self) -> None:
        plan = plan_release(["docker-compose.prod.yml"])
        self.assertFalse(plan.api_image)
        self.assertTrue(plan.api_recreate)
        self.assertFalse(plan.web_image)
        self.assertTrue(plan.web_recreate)

    def test_unknown_base_ships_everything(self) -> None:
        plan = plan_release(None, base_known=False)
        self.assertTrue(plan.api_image)
        self.assertTrue(plan.web_image)
        self.assertEqual(plan.spas, list(SPA_APPS))
        self.assertTrue(plan.migrate)

    def test_scope_api_does_not_publish_spas(self) -> None:
        plan = plan_release(["apps/admin/src/App.tsx", "apps/api/src/main.ts"], scope="api")
        self.assertTrue(plan.api_image)
        self.assertEqual(plan.spas, [])
        self.assertFalse(plan.migrate)

    def test_scope_frontends_with_apps(self) -> None:
        plan = plan_release([], scope="frontends", apps=["pos", "kds"])
        self.assertEqual(plan.spas, ["pos", "kds"])
        self.assertFalse(plan.api_image)
        self.assertFalse(plan.web_image)
        self.assertIn("waiter-landing", plan.landings)

    def test_scope_frontends_with_web(self) -> None:
        plan = plan_release([], scope="frontends", include_web=True)
        self.assertEqual(plan.spas, list(SPA_APPS))
        self.assertTrue(plan.web_image)

    def test_scope_all_always_migrates(self) -> None:
        plan = plan_release(["docs/DEPLOYMENT.md"], scope="all")
        self.assertTrue(plan.migrate)
        self.assertTrue(plan.nginx_frontends)

    def test_migrate_never_on_all(self) -> None:
        plan = plan_release([], scope="all", migrate="never")
        self.assertFalse(plan.migrate)

    def test_unknown_app_rejected(self) -> None:
        with self.assertRaises(ValueError):
            plan_release([], scope="frontends", apps=["support"])

    def test_flutter_only_note(self) -> None:
        plan = plan_release(["apps/guest/lib/main.dart"])
        self.assertFalse(plan.anything())
        self.assertTrue(any("Flutter" in note for note in plan.notes))

    def test_scripts_prod_syncs_without_restart(self) -> None:
        plan = plan_release(["scripts/prod/rollback.sh"])
        self.assertTrue(plan.sync_runtime_files)
        self.assertFalse(plan.api_recreate)
        self.assertFalse(plan.web_recreate)

    def test_classify_cli(self) -> None:
        script = Path(__file__).resolve().parent / "deploy_plan.py"
        proc = subprocess.run(
            [sys.executable, str(script), "--classify"],
            input="apps/api/src/main.ts\npackages/ui/src/index.ts\n",
            text=True,
            capture_output=True,
            check=True,
        )
        self.assertEqual(proc.stdout, "api=true\nweb=true\n")

    def test_json_cli_scope_frontends(self) -> None:
        script = Path(__file__).resolve().parent / "deploy_plan.py"
        proc = subprocess.run(
            [sys.executable, str(script), "--json", "--scope", "frontends", "--apps", "admin,pos"],
            input="",
            text=True,
            capture_output=True,
            check=True,
        )
        import json

        plan = json.loads(proc.stdout)
        self.assertEqual(plan["spas"], ["admin", "pos"])
        self.assertFalse(plan["api_image"])
        self.assertIn("waiter-landing", plan["landings"])

    def test_dockerfiles_copy_every_workspace_manifest(self) -> None:
        root = Path(__file__).resolve().parents[1]
        manifests = [
            path.relative_to(root).as_posix()
            for path in list((root / "apps").glob("*/package.json"))
            + list((root / "packages").glob("*/package.json"))
        ]
        self.assertGreaterEqual(len(manifests), 20)
        for dockerfile in (root / "Dockerfile", root / "Dockerfile.web"):
            text = dockerfile.read_text(encoding="utf-8")
            missing = [rel for rel in manifests if rel not in text]
            self.assertEqual(missing, [], dockerfile.name)

    def test_classify_cli_spa_only(self) -> None:
        script = Path(__file__).resolve().parent / "deploy_plan.py"
        proc = subprocess.run(
            [sys.executable, str(script), "--classify"],
            input="apps/pos/src/App.tsx\n",
            text=True,
            capture_output=True,
            check=True,
        )
        self.assertEqual(proc.stdout, "api=false\nweb=false\n")


if __name__ == "__main__":
    unittest.main()
