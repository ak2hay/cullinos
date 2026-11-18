#!/usr/bin/env bash
# Apply one release on the production VM. Called by GitHub Actions (scripts/ci/ship.sh).
# Images are already in GHCR. This script pulls, migrates, rolls the API, swaps
# static files, and snapshots. It never writes /opt/cullinos/.env.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cullinos}"
WWW_DIR="${WWW_DIR:-/var/www/cullinos}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
GHCR="${GHCR:-ghcr.io/ak2hay/cullinos}"
GIT_COMMIT="${GIT_COMMIT:-unknown}"
FULL_SHA="${FULL_SHA:-}"
RELEASE_API_IMAGE="${RELEASE_API_IMAGE:-0}"
RELEASE_API_RECREATE="${RELEASE_API_RECREATE:-0}"
RELEASE_WEB_IMAGE="${RELEASE_WEB_IMAGE:-0}"
RELEASE_WEB_RECREATE="${RELEASE_WEB_RECREATE:-0}"
RELEASE_MIGRATE="${RELEASE_MIGRATE:-0}"
RELEASE_NGINX="${RELEASE_NGINX:-0}"
RELEASE_SNAPSHOT="${RELEASE_SNAPSHOT:-1}"
PUBLISH_TAR="${PUBLISH_TAR:-}"
NGINX_CONF="${NGINX_CONF:-}"
NGINX_DEST="/etc/nginx/sites-available/cullinos-frontends.conf"

log() { echo "==> $*"; }

flag_on() { [[ "$1" == "1" || "$1" == "true" ]]; }

pull_ref() {
  local ref="$1"
  local attempt
  for attempt in 1 2 3 4 5; do
    if docker pull "$ref"; then
      return 0
    fi
    log "pull failed for $ref (attempt ${attempt}); retrying"
    sleep $((attempt * 5))
  done
  echo "Could not pull $ref" >&2
  return 1
}

logout() {
  docker logout ghcr.io >/dev/null 2>&1 || true
}

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  unset GHCR_TOKEN
  trap logout EXIT
fi

cd "$APP_DIR"

if flag_on "$RELEASE_API_IMAGE"; then
  if [[ ! "$FULL_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "FULL_SHA must be 40 hex chars to pull the API image" >&2
    exit 1
  fi
  log "Pulling API image ${GHCR}/api:${FULL_SHA}"
  pull_ref "${GHCR}/api:${FULL_SHA}"
  old_api="$(docker inspect -f '{{.Image}}' cullinos-api 2>/dev/null || true)"
  docker tag "${GHCR}/api:${FULL_SHA}" cullinos-api:current
fi

if flag_on "$RELEASE_MIGRATE"; then
  log "prisma migrate deploy (previous API keeps serving)"
  if ! docker compose -f "$COMPOSE_FILE" run --rm -T --no-deps api \
    node packages/prisma/scripts/migrate-deploy.mjs; then
    if [[ -n "${old_api:-}" ]]; then
      docker tag "$old_api" cullinos-api:current
    fi
    echo "Migrations failed. Traffic was not moved." >&2
    exit 1
  fi
fi

if flag_on "$RELEASE_API_RECREATE"; then
  expect="$GIT_COMMIT"
  if ! flag_on "$RELEASE_API_IMAGE"; then
    expect="-"
  fi
  log "Rolling API (expect commit ${expect})"
  bash "$APP_DIR/scripts/prod/roll-api.sh" "cullinos-api:current" "$expect"
fi

if [[ -n "$PUBLISH_TAR" ]]; then
  log "Publishing static files from $PUBLISH_TAR"
  stage="$(mktemp -d)"
  tar -xzf "$PUBLISH_TAR" -C "$stage"
  mkdir -p "$WWW_DIR"
  shopt -s nullglob
  published=()
  for dir in "$stage"/*; do
    [[ -d "$dir" ]] || continue
    name="$(basename "$dir")"
    rm -rf "${WWW_DIR}/${name}"
    mv "$dir" "${WWW_DIR}/${name}"
    published+=("$name")
  done
  rm -rf "$stage"
  log "Published: ${published[*]:-none}"
fi

if flag_on "$RELEASE_NGINX"; then
  if [[ -z "$NGINX_CONF" || ! -f "$NGINX_CONF" ]]; then
    echo "RELEASE_NGINX=1 but NGINX_CONF is missing" >&2
    exit 1
  fi
  log "Installing frontend nginx config"
  stamp="$(date +%s)"
  if [[ -f "$NGINX_DEST" ]]; then
    cp -a "$NGINX_DEST" "/root/cullinos-frontends.conf.bak-${stamp}"
    cp -a "$NGINX_DEST" /tmp/cullinos-frontends.prev
  fi
  cp "$NGINX_CONF" "$NGINX_DEST"
  if nginx -t; then
    systemctl reload nginx
    log "nginx reloaded"
  else
    if [[ -f /tmp/cullinos-frontends.prev ]]; then
      cp /tmp/cullinos-frontends.prev "$NGINX_DEST"
      nginx -t && systemctl reload nginx
    fi
    echo "nginx config rejected; previous file restored" >&2
    exit 1
  fi
fi

if flag_on "$RELEASE_WEB_IMAGE"; then
  if [[ ! "$FULL_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "FULL_SHA must be 40 hex chars to pull the web image" >&2
    exit 1
  fi
  log "Pulling web image ${GHCR}/web:${FULL_SHA}"
  pull_ref "${GHCR}/web:${FULL_SHA}"
  docker tag "${GHCR}/web:${FULL_SHA}" cullinos-web:current
fi

if flag_on "$RELEASE_WEB_RECREATE"; then
  log "Recreating marketing web"
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build web
fi

health="$(curl -sf http://127.0.0.1:3000/api/v1/health || true)"
log "Health: ${health}"
if flag_on "$RELEASE_API_RECREATE"; then
  python3 - "$GIT_COMMIT" "$health" <<'PY'
import json, sys
expect, raw = sys.argv[1], sys.argv[2]
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    sys.exit("health response was not JSON")
if data.get("status") != "ok":
    sys.exit(f"API status is {data.get('status')!r}")
if expect and expect != "-" and data.get("commit") != expect:
    sys.exit(f"health commit {data.get('commit')!r} != {expect}")
PY
fi

if flag_on "$RELEASE_SNAPSHOT"; then
  log "Snapshotting release"
  if ! RELEASE_GIT_SHA="${FULL_SHA:-}" bash "$APP_DIR/scripts/prod/snapshot-release.sh"; then
    echo "Warning: snapshot failed. The release is live; rollback.sh may not see it until snapshot-release.sh succeeds." >&2
  fi
fi

log "Release complete (${GIT_COMMIT})"
