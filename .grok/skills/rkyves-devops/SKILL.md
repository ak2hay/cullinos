---
name: rkyves-devops
description: Cullinos DevOps skill—CI, Docker, Docker Compose VM deploys over SSH. Use for deploy plans, workflow changes, rollback, and infra reviews.
---

# DevOps

## Sources

- `docs/DEPLOYMENT.md`, `docs/BACKUP_ROLLBACK.md`
- `.github/workflows/`, `Dockerfile*`, `docker-compose.prod.yml`, `infrastructure/`, `scripts/`
- Production deploys when `main` is pushed (`.github/workflows/deploy.yml`). Fresh VM / full rebuild: `scripts/remote-deploy.py`. Redeploy without a new commit: `bash scripts/deploy.sh`.

## Deploy plan template

1. What is shipping (commits on `main`)
2. What the Deploy workflow will rebuild (API image, web image, which SPAs, migrations)
3. Migrations included (`packages/prisma/prisma/migrations`)
4. Rollback (`scripts/prod/rollback.sh`, R2 restore for DB)
5. Watch window / health checks (`/api/v1/health` commit matches the first 7 hex chars)

## Hard stops

- Do not push to `main` unless that change should deploy. Never force-push `main`
- `scripts/remote-deploy.py` replaces `/opt/cullinos` and is for a fresh VM or full rebuild, not a routine release
