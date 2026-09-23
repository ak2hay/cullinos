# Contributing to Cullinos

## Branch model

```
feature/<module>-short-desc  →  develop  →  main
```

| Branch | Purpose | Deploy |
|--------|---------|--------|
| `feature/*` | Module work (one concern per branch) | None |
| `develop` | Integration / staging | Auto → **staging** namespace |
| `main` | Production | Auto → **production** namespace |

### Rules

1. Branch from `develop`, not `main`.
2. Name features by area: `feature/api-payments`, `feature/admin-coupons`, `feature/pos-print`.
3. Open a **PR into `develop`**. CI (`CI`, `Security`, path-filtered `API Build`) must pass.
4. After staging validation, open a **PR from `develop` → `main`** for production.
5. Do not push directly to `develop` or `main` (enable branch protection in GitHub — see below).
6. Keep the monorepo: parallel work is branches + path owners, not separate repos.

## GitHub branch protection (manual once)

In **Settings → Branches** for `ak2hay/cullinos`:

**`develop` and `main`:**

- Require a pull request before merging
- Require approvals: ≥ 1
- Require status checks: `CI` / `build`, `Security` / `analyze` (and `API Build` when API paths change)
- Do not allow force pushes
- Do not allow deletions

Optional on `main`: GitHub Environment **production** with required reviewers before CD runs.

## CODEOWNERS

See [`.github/CODEOWNERS`](.github/CODEOWNERS). Request review from path owners when your PR touches their apps.

## Local development

See [README.md](README.md). Use `npm run docker:up` for Postgres/Redis; never point local apps at production.

## Deploy / infra

Production and staging run on **k3s** on the OnLiveServer VM. Images ship via **GHCR**; CD is GitHub Actions. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Emergency-only legacy path: `scripts/remote-deploy.py` (Compose/SSH) — do not use for normal releases.
