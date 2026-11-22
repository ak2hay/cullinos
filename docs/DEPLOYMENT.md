# Cullinos — Production Deployment (Docker Compose on VM)

Production runs on the OnLiveServer VM (`95.135.254.73`) as a **Docker Compose** stack in
`/opt/cullinos`. Host **nginx** terminates TLS (certbot) and serves the static SPAs. There is no
separate staging environment.

**A push to `main` deploys.** The [Deploy workflow](../.github/workflows/deploy.yml) builds only
what that push changed, pushes `api` and `web` images to GHCR, and SSHs to the VM to pull and
roll. Push `main` only when the change should go live. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Architecture

| Component | How | Domain |
|-----------|-----|--------|
| API + WebSocket | Compose `api` (`Dockerfile`, `127.0.0.1:3000`) behind nginx | `api.cullinos.com` |
| Postgres + Redis | Compose `postgres` / `redis`, named volumes | internal |
| Admin / Manage / Platform / App Ops | Static files in `/var/www/cullinos/<app>` | `admin` / `manage` / `platform` / `app` |
| POS / KDS / Kiosk | Static files in `/var/www/cullinos/<app>` | `pos` / `kds` / `kiosk` |
| Guest / Waiter landings | Static files from `infrastructure/www/` | `guest` / `waiter` |
| Marketing | Compose `web` (`Dockerfile.web`, `127.0.0.1:5180`) behind nginx | `cullinos.com` |

Files: [`docker-compose.prod.yml`](../docker-compose.prod.yml), nginx configs in
[`infrastructure/nginx/`](../infrastructure/nginx/), runtime config in `/opt/cullinos/.env` on the VM
(template: [`.env.production.example`](../.env.production.example)).

## Configuration

- **Runtime secrets** live only in `/opt/cullinos/.env` on the VM. The Deploy workflow never
  writes that file. `TURNSTILE_SECRET_KEY` stays there; captcha stays off until it is set.
  Once set, browser portals and the marketing site require a token. Native clients skip
  verification while `TURNSTILE_EXEMPT_NATIVE` is unset or `true` (the default): a
  `User-Agent` starting with `Dart/` (installed Flutter, including guest APK 1.0.4), a
  user agent containing `Electron/` (installed POS/KDS desktop), or
  `X-Cullinos-Client: guest-android|waiter-android|pos-desktop|kds-desktop` on new builds.
  Set `TURNSTILE_EXEMPT_NATIVE=false` to require a token from every client. Per-IP rate
  limits on those routes stay in place either way. Flutter release builds pass the public
  site key with `scripts/flutter-mobile-defines.sh` (`TURNSTILE_SITE_KEY`, default
  `0x4AAAAAAGI4qZ7befLdSFze`).
- **Build-time public keys** are GitHub Actions variables (Settings → Secrets and variables →
  Actions → Variables). They are not secrets:
  - `VITE_TURNSTILE_SITE_KEY` — login / forgot-password captcha in the SPAs
  - `ANDROID_ASSETLINKS_SHA256` — comma-separated Play app-signing and upload-key SHA-256
    fingerprints for `guest-landing/.well-known/assetlinks.json`. Empty keeps the placeholder, and
    Android App Links do not verify.
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` — marketing site
  For a local `npm run build:frontends`, export the Vite variables in your shell. A VM image build
  (`remote-deploy.py`) still reads the `NEXT_PUBLIC_*` values from the VM `.env`.
- Production URLs (`VITE_API_URL` etc.) default to the `*.cullinos.com` hosts in
  [`scripts/build-frontends.sh`](../scripts/build-frontends.sh).

## Where routine releases used to spend their time

The old path (`vm-selective-redeploy.py` after a local `npm run build:frontends`) did all of this
on every release. Times are estimates from the scripts and Dockerfiles, not a stopwatch on the VM:

| Step | Why it was slow |
|------|-----------------|
| Local `build-frontends.sh` | Eight Vite apps, one after another, plus a Next.js build that was thrown away (the VM rebuilt `web` in Docker) |
| Upload of `apps/` + `packages/` | Every release, even a one-line SPA change |
| `docker compose build api` on the VM | The Dockerfile copied all source *before* `npm ci`, so any edit reinstalled all ~1700 lockfile packages on the VM, then compiled the API |
| `prisma migrate deploy` | Always, including when `migrations/` did not change |
| Upload and swap of every SPA `dist` | Always |
| `docker compose build web` on the VM | A second uncached `npm ci` and Next.js build |
| `--force-recreate` of `api` | The build itself did not drop traffic, but the recreate did, for the whole boot |

A routine release was typically on the order of **25–50 minutes**, most of it the two VM image
builds. `remote-deploy.py` was slower still (`docker compose build --no-cache`).

## Routine release

```bash
git push origin main
```

The Deploy workflow then:

1. Diffs that push and skips anything that did not change (API image, web image, each SPA, migrations, frontend nginx).
2. Builds the API and web images on GitHub-hosted runners (BuildKit cache, manifest layer before `npm ci`) and pushes them to `ghcr.io/ak2hay/cullinos/api` and `.../web`, tagged with the full commit SHA. The first 7 hex characters are baked in as `GIT_COMMIT`.
3. Builds only the changed SPAs, in parallel (`scripts/build-frontends.sh`, turbo).
4. SSHs to the VM, pulls those images, runs `prisma migrate deploy` only when migration files changed (the previous API keeps serving), then `scripts/prod/roll-api.sh` starts the new API on `:3010` (`:3001` is another service on the VM), points nginx at it, recreates Compose on `:3000`, and points nginx back. If the VM has under ~700MB free, it recreates in place instead (a short blip).
5. Swaps only the SPA directories that were built, reloads frontend nginx only when that file changed, and recreates `web` only when the marketing image changed.
6. Runs `scripts/prod/snapshot-release.sh` so `rollback.sh` can restore this release. Rollback does not touch the database ([BACKUP_ROLLBACK.md](BACKUP_ROLLBACK.md)).

The workflow does not write `/opt/cullinos/.env`.

Redeploy the current `main` commit without another push:

```bash
bash scripts/deploy.sh                  # api + web + every SPA + migrate
bash scripts/deploy.sh api              # API image, migrate, roll
bash scripts/deploy.sh frontends        # every SPA and the waiter landing
bash scripts/deploy.sh frontends admin pos
bash scripts/deploy.sh web              # marketing image only
```

`scripts/deploy.sh` starts the same workflow (`workflow_dispatch`). It needs the GitHub CLI, logged in.

### Expected time after the one-time setup

These assume GitHub's npm/BuildKit caches are warm and the VM can pull GHCR. The first image build
after this lands fills the cache and is the slow run.

| What changed | Expected |
|--------------|----------|
| One SPA | 3–6 minutes |
| All SPAs, no API or web | 4–8 minutes |
| API only (migrations only if `migrations/` changed) | 4–8 minutes |
| API + web + all SPAs | 8–15 minutes |
| First build of an image (cold cache) | 15–25 minutes |

Docs-only pushes plan an empty release and do not SSH.

### One-time setup

1. **Actions secrets** (Settings → Secrets and variables → Actions → Secrets):
   - `DEPLOY_HOST` — `95.135.254.73`
   - `DEPLOY_SSH_KEY` — private key that can `ssh root@` the VM. Put the matching public key in `/root/.ssh/authorized_keys` on the VM. Prefer a dedicated key, not a password.
   - `DEPLOY_SSH_KNOWN_HOSTS` (optional) — output of `ssh-keyscan -H 95.135.254.73`. Without it, the runner accepts the host key on first connect.
2. **VM firewall.** GitHub-hosted runners use a wide IP range. SSH on the VM must accept that key from those runners (key auth, not a password pasted into the workflow).
3. **Actions variables** listed under Configuration, if captcha, asset links, or marketing analytics should be on.
4. **GHCR.** The first Deploy run creates `ghcr.io/ak2hay/cullinos/api` and `.../web`. The workflow logs in with `GITHUB_TOKEN` for the length of the job and logs out on the VM. No token is written into `.env` or committed. Packages stay private; the VM does not need its own `docker login`.
5. **Docker on the VM** must be Compose v2 with BuildKit (the Dockerfiles already use `# syntax=docker/dockerfile:1`). Confirm with `docker buildx version`.
6. If `main` is set to require a pull request, allow direct pushes, or this workflow never runs.

Until `DEPLOY_HOST` and `DEPLOY_SSH_KEY` exist, a push still builds and pushes images, then the deploy job fails with a pointer back here. The VM is left as it was.

### Legacy scripts

| Script | Use |
|--------|-----|
| [`scripts/remote-deploy.py`](../scripts/remote-deploy.py) | **Fresh VM or full rebuild.** Installs Docker/nginx/ufw, replaces `/opt/cullinos` (keeps `.env`), migrations, nginx + certbot, release snapshot |
| [`scripts/vm-selective-redeploy.py`](../scripts/vm-selective-redeploy.py) | Previous routine path (build on the VM over SSH). Use only if Actions cannot reach the VM |
| [`scripts/vm-db-sync-schema.py`](../scripts/vm-db-sync-schema.py) | Baseline a legacy `db push` database, then `migrate deploy` (see below) |

Other `scripts/vm-*.py` files are one-off helpers from earlier releases; read them before reuse.

## GitHub workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `Deploy` | push to `main`, or `workflow_dispatch` | Build changed images/SPAs, pull on the VM, roll, snapshot |
| `CI` | push to `main` (and pull requests) | `migrate deploy` + drift check, seed, lint, typecheck, build, tests, `flutter analyze`/`test` |
| `API Build` | push to `main` (API paths) | Production API compile check |
| `Security` | push to `main`, pull requests, weekly | npm audit, CodeQL, gitleaks, Trivy |
| `Uptime Check` | every 15m | SSH to the VM and curl origin nginx (bypasses Cloudflare) |
| `E2E Production` | nightly | Playwright against prod |

## Build commit in `/health`

`GET /api/v1/health` reports `commit` from `GIT_COMMIT` (or `DEPLOY_COMMIT`); it shows `unknown` when neither is set.

The Deploy workflow bakes the first 7 hex characters of the commit. By hand on the VM:

```bash
GIT_COMMIT=$(git rev-parse HEAD | cut -c1-7) docker compose -f docker-compose.prod.yml up -d --build api
```

After a deploy, `curl -s https://api.cullinos.com/api/v1/health` should show that 7-character prefix.

## Database migrations

Schema changes ship as Prisma migrations in `packages/prisma/prisma/migrations` and are applied
with `prisma migrate deploy` (`packages/prisma/scripts/migrate-deploy.mjs`) by the deploy scripts.
`db push` is for local development only; `--accept-data-loss` / `--force-reset` are not used anywhere.

New change: edit `schema.prisma`, then `npm run db:migrate -- --name <change>` locally and commit
the generated folder.

**Baselining an existing database (one time, human-run).** `0_init` is the full schema. Databases
that were created with `db push` must be caught up and marked as baselined instead of running it.
`DEPLOY_HOST=<ip> python scripts/vm-db-sync-schema.py` automates steps 2–6 with confirmations.

1. Back up (`bash /opt/cullinos/scripts/prod/backup.sh`).
2. Run `packages/prisma/prisma/baseline/precheck.sql`; every query must return no rows.
3. Generate and review the catch-up SQL. Target the frozen `0_init` schema, not `schema.prisma`,
   so the later migrations (and their data steps, e.g. `platform_role = 'owner'` for existing
   super admins) still run in step 6:
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel packages/prisma/prisma/baseline/schema-0_init.prisma --script > catchup.sql`
4. Apply it: `npx prisma db execute --url "$DATABASE_URL" --file catchup.sql`, then run the backfills
   at the bottom of `precheck.sql`.
5. `npx prisma migrate resolve --applied 0_init --schema packages/prisma/prisma/schema.prisma`
6. `node packages/prisma/scripts/migrate-deploy.mjs` applies the migrations after `0_init`;
   `npx prisma migrate status` must then report the database is up to date.

`migrate-deploy.mjs` refuses to run on a database that has tables but no `0_init` record.

**Failed migration (P3009).** `migrate deploy` stops while any migration is recorded as failed.
Check which of its statements landed, then mark it with
`npx prisma migrate resolve --rolled-back <name>` (it will be retried) or `--applied <name>`
(it completed), and rerun the deploy.

## Backups

Cron on the VM (`scripts/prod/install-cron.sh`) uploads a daily pack and hourly Postgres dumps to
Cloudflare R2. Setup, restore and the quarterly drill: [BACKUP_ROLLBACK.md](BACKUP_ROLLBACK.md).

## Rollback

- **App:** `bash /opt/cullinos/scripts/prod/rollback.sh` (or `--list`, then `rollback.sh <id>`).
  Restores API/web images and `/var/www/cullinos`; does not touch the database.
  The Deploy workflow runs `snapshot-release.sh` after a healthy release. If that snapshot fails,
  the new release is still live; run `snapshot-release.sh` on the VM before you rely on rollback.
- **DB:** R2 restore, see [BACKUP_ROLLBACK.md](BACKUP_ROLLBACK.md).

## QR table ordering

1. Waiter opens **Cullinos Waiter** → table → **Show QR to customers**
2. Session QR: `https://guest.cullinos.com/{orgSlug}/{outletSlug}?session={token}`
3. Guests order into the shared table order; waiter ends session when cleared.

## Local development

```bash
cp .env.example .env
npm run docker:up
npm install
npm run db:generate && npm run db:migrate:deploy && npm run db:seed
npm run dev
```

Do not point local apps at production. See [CONTRIBUTING.md](../CONTRIBUTING.md).
