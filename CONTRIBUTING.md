# Contributing to Cullinos

## Branch model

Changes go on `main`. **Pushing `main` deploys production** (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

| Branch | Purpose | Deploy |
|--------|---------|--------|
| `main` | The only integration branch | Push runs the Deploy workflow |

### Rules

1. Commit on `main` (or a short-lived local branch that you push to `main`). Do not open a PR into `develop`.
2. Do not push to `main` unless that commit should ship to production.
3. Do not force-push `main`.
4. Keep the monorepo: parallel work is path owners, not separate repos.

## GitHub branch protection (manual once)

In **Settings → Branches** for `ak2hay/cullinos`, on `main`:

- Allow direct pushes (a required pull request would block the deploy path)
- Do not allow force pushes
- Do not allow deletions

Dependabot still opens pull requests, targeted at `main`. Merging one pushes `main` and deploys.

## CODEOWNERS

See [`.github/CODEOWNERS`](.github/CODEOWNERS). Request review from path owners when your PR touches their apps.

## Local development

See [README.md](README.md). Use `npm run docker:up` for Postgres/Redis; never point local apps at production.

## Deploy / infra

Production runs as a **Docker Compose** stack on the OnLiveServer VM. A push to `main` deploys it. Fresh VM / full rebuild: `scripts/remote-deploy.py`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
