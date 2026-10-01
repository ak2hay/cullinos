# Cullinos — Production Deployment (Docker Compose on VM)

Production runs on the OnLiveServer VM (`95.135.254.46`) as a **Docker Compose** stack in
`/opt/cullinos`. Host **nginx** terminates TLS (certbot) and serves the static SPAs. Releases are
pushed from a developer machine over SSH with the Python scripts in `scripts/`. There is no
separate staging environment. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the branch model.

Production deploys need explicit human approval.

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

- **Runtime secrets** live only in `/opt/cullinos/.env` on the VM. Deploy scripts never overwrite it.
- **Marketing build keys** (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN`)
  are read from the same VM `.env` when Compose builds `web`.
- **SPA build keys** are baked in on the machine that builds the frontends. Set them in your shell
  before `npm run build:frontends`:
  - `VITE_TURNSTILE_SITE_KEY` (login / forgot-password captcha). Captcha stays off while the VM
    `.env` has no `TURNSTILE_SECRET_KEY`; set that secret only after every client (Vite portals,
    guest app) ships with the matching site key.
  - `ANDROID_ASSETLINKS_SHA256`: comma-separated SHA-256 cert fingerprints (Play app signing + upload key)
    for `guest-landing/.well-known/assetlinks.json`. Without it the placeholder ships and Android App
    Links do not verify.
- Production URLs (`VITE_API_URL` etc.) default to the `*.cullinos.com` hosts in
  [`scripts/build-frontends.sh`](../scripts/build-frontends.sh).

## Deploy scripts

All scripts take `DEPLOY_HOST` (required) and `DEPLOY_PASSWORD`, and run from the repo root on the
commit you want to ship. Prefer SSH keys and rotate the root password if it was ever pasted into a
shared terminal or chat.

| Script | Use |
|--------|-----|
| [`scripts/vm-selective-redeploy.py`](../scripts/vm-selective-redeploy.py) | **Routine release.** Overlays sources, rebuilds `api`, runs `migrate deploy`, publishes SPAs + landings, installs `cullinos-frontends.conf`, rebuilds `web` |
| [`scripts/remote-deploy.py`](../scripts/remote-deploy.py) | **Fresh VM or full rebuild.** Installs Docker/nginx/ufw, replaces `/opt/cullinos` (keeps `.env`), migrations, nginx + certbot, release snapshot |
| [`scripts/vm-db-sync-schema.py`](../scripts/vm-db-sync-schema.py) | Baseline a legacy `db push` database, then `migrate deploy` (see below) |

Other `scripts/vm-*.py` files are one-off helpers from earlier releases; read them before reuse.

### Routine release

```bash
git checkout main && git pull
npm ci
VITE_TURNSTILE_SITE_KEY=... ANDROID_ASSETLINKS_SHA256=... npm run build:frontends

# PowerShell: $env:DEPLOY_HOST="95.135.254.46"; $env:DEPLOY_PASSWORD="..."
DEPLOY_HOST=95.135.254.46 DEPLOY_PASSWORD=... python scripts/vm-selective-redeploy.py
```

Flags: `DEPLOY_PREFLIGHT_ONLY=1` (read-only checks), `DEPLOY_WEB=0` (skip marketing rebuild),
`DEPLOY_NGINX=0` (skip nginx config install). The script prints a report and exits non-zero if any
step failed.

After a good deploy, snapshot it for one-command rollback:

```bash
ssh root@95.135.254.46 'bash /opt/cullinos/scripts/prod/snapshot-release.sh'
```

## GitHub workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `CI` | PR + push to `develop`/`main` | `migrate deploy` + drift check, seed, lint, typecheck, build, tests, `flutter analyze`/`test` |
| `API Build` | PR + push to `main` (API paths) | Production API build check |
| `Security` | PR + push to `develop`/`main` + weekly | npm audit, CodeQL, gitleaks, Trivy |
| `Uptime Check` | every 15m | Curl health URLs |
| `E2E Production` | nightly | Playwright against prod |

No workflow deploys. Merge to `main`, wait for CI, then run the deploy script.

## Build commit in `/health`

`GET /api/v1/health` reports `commit` from `GIT_COMMIT` (or `DEPLOY_COMMIT`); it shows `unknown` when neither is set.

The deploy scripts read the local `git rev-parse` and run `GIT_COMMIT=<sha> docker compose -f docker-compose.prod.yml build api`. By hand on the VM:

```bash
GIT_COMMIT=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build api
```

After a deploy, check `curl -s https://api.cullinos.com/api/v1/health` returns the SHA you shipped.

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
