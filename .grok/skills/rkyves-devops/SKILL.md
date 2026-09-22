---
name: rkyves-devops
description: Cullinos DevOps skill—CI/CD, Docker, GHCR, k3s staging/production. Use for deploy plans, workflow changes, rollback, and infra reviews.
---

# DevOps

## Sources

- `docs/DEPLOYMENT.md`, `docs/BACKUP_ROLLBACK.md`
- `.github/workflows/`, `Dockerfile*`, `infrastructure/`
- Branch deploys: `develop` → staging, `main` → production

## Deploy plan template

1. What is shipping (commits/PRs)
2. Workflows/images involved
3. Staging verification
4. Production steps (human-approved)
5. Rollback
6. Watch window / health checks (`/api/v1/health`)

## Hard stops

- Never run production deploy or merge to `main` without human approval
- Never force-push `develop`/`main`
- Prefer documenting emergency `scripts/remote-deploy.py` as legacy-only
