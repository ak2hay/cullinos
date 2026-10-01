---
name: rkyves-devops
description: Cullinos DevOps skill—CI, Docker, Docker Compose VM deploys over SSH. Use for deploy plans, workflow changes, rollback, and infra reviews.
---

# DevOps

## Sources

- `docs/DEPLOYMENT.md`, `docs/BACKUP_ROLLBACK.md`
- `.github/workflows/`, `Dockerfile*`, `docker-compose.prod.yml`, `infrastructure/`, `scripts/`
- Production deploys from `main` with `scripts/vm-selective-redeploy.py`; fresh VM / full rebuild with `scripts/remote-deploy.py`

## Deploy plan template

1. What is shipping (commits/PRs)
2. Frontend build (`npm run build:frontends`) and deploy script/flags involved
3. Migrations included (`packages/prisma/prisma/migrations`)
4. Production steps (human-approved)
5. Rollback (`scripts/prod/rollback.sh`, R2 restore for DB)
6. Watch window / health checks (`/api/v1/health` commit matches)

## Hard stops

- Never run production deploy or merge to `main` without human approval
- Never force-push `develop`/`main`
- Use `scripts/vm-selective-redeploy.py` for routine releases; `scripts/remote-deploy.py` replaces `/opt/cullinos` and is for a fresh VM or full rebuild
