#!/usr/bin/env bash
# Run on a GitHub-hosted runner. Copy the release onto the VM and run it.
# Requires DEPLOY_HOST and DEPLOY_SSH_KEY. Never prints the key or GHCR token.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DEPLOY_HOST:-}" || -z "${DEPLOY_SSH_KEY:-}" ]]; then
  echo "::error::Production was not updated. Add Actions secrets DEPLOY_HOST and DEPLOY_SSH_KEY (see docs/DEPLOYMENT.md)." >&2
  exit 1
fi

flag() {
  case "${1:-}" in
    true|1|yes|TRUE) echo 1 ;;
    *) echo 0 ;;
  esac
}

API_IMAGE="$(flag "${RELEASE_API_IMAGE:-}")"
API_RECREATE="$(flag "${RELEASE_API_RECREATE:-}")"
WEB_IMAGE="$(flag "${RELEASE_WEB_IMAGE:-}")"
WEB_RECREATE="$(flag "${RELEASE_WEB_RECREATE:-}")"
MIGRATE="$(flag "${RELEASE_MIGRATE:-}")"
NGINX="$(flag "${RELEASE_NGINX:-}")"
USER_NAME="${DEPLOY_USER:-root}"
PORT="${DEPLOY_SSH_PORT:-22}"
repo="${GITHUB_REPOSITORY:-ak2hay/cullinos}"
GHCR="${GHCR:-ghcr.io/${repo,,}}"
SHORT="${GIT_COMMIT:-${GITHUB_SHA:0:7}}"
FULL="${FULL_SHA:-${GITHUB_SHA:-}}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
install -m 700 -d "$workdir/ssh"
printf '%s\n' "$DEPLOY_SSH_KEY" | tr -d '\r' > "$workdir/ssh/id"
chmod 600 "$workdir/ssh/id"
unset DEPLOY_SSH_KEY

known="$workdir/ssh/known_hosts"
strict=( -o StrictHostKeyChecking=accept-new )
if [[ -n "${DEPLOY_SSH_KNOWN_HOSTS:-}" ]]; then
  printf '%s\n' "$DEPLOY_SSH_KNOWN_HOSTS" > "$known"
  strict=( -o StrictHostKeyChecking=yes )
else
  : > "$known"
fi

SSH=(ssh -i "$workdir/ssh/id" -p "$PORT" -o IdentitiesOnly=yes -o UserKnownHostsFile="$known" "${strict[@]}")
SCP=(scp -i "$workdir/ssh/id" -P "$PORT" -o IdentitiesOnly=yes -o UserKnownHostsFile="$known" "${strict[@]}")
target="${USER_NAME}@${DEPLOY_HOST}"

echo "==> Uploading compose file and prod scripts"
"${SSH[@]}" "$target" "mkdir -p /opt/cullinos/scripts/prod /var/www/cullinos"
"${SCP[@]}" docker-compose.prod.yml "${target}:/opt/cullinos/docker-compose.prod.yml"
"${SCP[@]}" scripts/prod/release.sh scripts/prod/roll-api.sh scripts/prod/nginx_roll.py \
  scripts/prod/snapshot-release.sh scripts/prod/rollback.sh scripts/prod/_common.sh \
  scripts/prod/backup.sh scripts/prod/backup-db-hourly.sh scripts/prod/restore-backup.sh \
  scripts/prod/install-cron.sh scripts/prod/r2_sync.py \
  "${target}:/opt/cullinos/scripts/prod/"
"${SSH[@]}" "$target" "chmod 755 /opt/cullinos/scripts/prod/*.sh"

publish_remote=""
if [[ -n "${FRONTENDS_TAR:-}" && -f "$FRONTENDS_TAR" ]]; then
  echo "==> Uploading frontend tarball"
  "${SCP[@]}" "$FRONTENDS_TAR" "${target}:/tmp/cullinos-publish.tar.gz"
  publish_remote="/tmp/cullinos-publish.tar.gz"
fi

nginx_remote=""
if [[ "$NGINX" == "1" ]]; then
  echo "==> Uploading frontend nginx config"
  "${SCP[@]}" infrastructure/nginx/cullinos-frontends.conf "${target}:/tmp/cullinos-frontends.conf"
  nginx_remote="/tmp/cullinos-frontends.conf"
fi

SHORT="$SHORT" FULL="$FULL" GHCR="$GHCR" \
  API_IMAGE="$API_IMAGE" API_RECREATE="$API_RECREATE" \
  WEB_IMAGE="$WEB_IMAGE" WEB_RECREATE="$WEB_RECREATE" \
  MIGRATE="$MIGRATE" NGINX="$NGINX" \
  PUBLISH_REMOTE="$publish_remote" NGINX_REMOTE="$nginx_remote" \
  python3 - "$workdir/release.env" <<'PY'
import os, sys
path = sys.argv[1]
keys = {
    "GIT_COMMIT": "SHORT",
    "FULL_SHA": "FULL",
    "GHCR": "GHCR",
    "RELEASE_API_IMAGE": "API_IMAGE",
    "RELEASE_API_RECREATE": "API_RECREATE",
    "RELEASE_WEB_IMAGE": "WEB_IMAGE",
    "RELEASE_WEB_RECREATE": "WEB_RECREATE",
    "RELEASE_MIGRATE": "MIGRATE",
    "RELEASE_NGINX": "NGINX",
    "PUBLISH_TAR": "PUBLISH_REMOTE",
    "NGINX_CONF": "NGINX_REMOTE",
    "GHCR_USER": "GHCR_USER",
    "GHCR_TOKEN": "GHCR_TOKEN",
}
def shell(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"
lines = ["RELEASE_SNAPSHOT='1'"]
for dest, src in keys.items():
    lines.append(f"{dest}={shell(os.environ.get(src, ''))}")
with open(path, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines) + "\n")
os.chmod(path, 0o600)
PY

echo "==> Running release on the VM"
"${SCP[@]}" "$workdir/release.env" "${target}:/tmp/cullinos-release.env"
"${SSH[@]}" "$target" "set -a && . /tmp/cullinos-release.env && set +a && rm -f /tmp/cullinos-release.env && bash /opt/cullinos/scripts/prod/release.sh"
echo "==> VM release finished"
