#!/usr/bin/env bash
# Snapshot a successful prod deploy for one-command rollback.
# Usage (on VM as root): /opt/cullinos/scripts/prod/snapshot-release.sh [release-id]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

mkdir -p "$RELEASES_DIR" "$BACKUP_LOCAL_DIR"

RELEASE_ID="${1:-$(make_release_id)}"
DEST="$RELEASES_DIR/$RELEASE_ID"
mkdir -p "$DEST/config"

echo "==> Snapshotting release $RELEASE_ID"

# Remember previous current before promoting
if [[ -L "$CURRENT_LINK" || -f "$CURRENT_LINK" ]]; then
  prev="$(readlink -f "$CURRENT_LINK" 2>/dev/null || cat "$CURRENT_LINK" 2>/dev/null || true)"
  if [[ -n "$prev" && -d "$prev" ]]; then
    ln -sfn "$prev" "$PREVIOUS_LINK"
  fi
fi

# Tag running API/web images
tag_running_or_named "cullinos-api" "$API_IMAGE" "$RELEASE_ID"
tag_running_or_named "cullinos-web" "$WEB_IMAGE" "$RELEASE_ID"

# Maintain :current / :previous aliases
if docker image inspect "${API_IMAGE}:current" >/dev/null 2>&1; then
  docker tag "${API_IMAGE}:current" "${API_IMAGE}:previous" 2>/dev/null || true
fi
if docker image inspect "${WEB_IMAGE}:current" >/dev/null 2>&1; then
  docker tag "${WEB_IMAGE}:current" "${WEB_IMAGE}:previous" 2>/dev/null || true
fi
docker tag "${API_IMAGE}:${RELEASE_ID}" "${API_IMAGE}:current"
docker tag "${WEB_IMAGE}:${RELEASE_ID}" "${WEB_IMAGE}:current"

# Frontends
if [[ -d "$WWW_DIR" ]]; then
  tar -C "$(dirname "$WWW_DIR")" -czf "$DEST/frontends.tar.gz" "$(basename "$WWW_DIR")"
else
  echo "Warning: $WWW_DIR missing — frontends not snapshotted." >&2
fi

# Config copies
umask 077
if [[ -f "$APP_DIR/.env" ]]; then
  cp -a "$APP_DIR/.env" "$DEST/config/.env"
  chmod 600 "$DEST/config/.env"
fi
[[ -f "$COMPOSE_FILE" ]] && cp -a "$COMPOSE_FILE" "$DEST/config/docker-compose.prod.yml"
[[ -f /etc/nginx/sites-available/cullinos-api.conf ]] && \
  cp -a /etc/nginx/sites-available/cullinos-api.conf "$DEST/config/cullinos-api.conf"
[[ -f /etc/nginx/sites-available/cullinos-frontends.conf ]] && \
  cp -a /etc/nginx/sites-available/cullinos-frontends.conf "$DEST/config/cullinos-frontends.conf"
if [[ -d "$APP_DIR/secrets" ]]; then
  tar -C "$APP_DIR" -czf "$DEST/config/secrets.tar.gz" secrets
fi

write_compose_override_images \
  "$DEST/docker-compose.release.yml" \
  "${API_IMAGE}:${RELEASE_ID}" \
  "${WEB_IMAGE}:${RELEASE_ID}"

API_ID="$(image_id_of "${API_IMAGE}:${RELEASE_ID}")"
WEB_ID="$(image_id_of "${WEB_IMAGE}:${RELEASE_ID}")"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_SHA="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")"

cat >"$DEST/manifest.json" <<EOF
{
  "release_id": "$RELEASE_ID",
  "created_at": "$CREATED_AT",
  "git_sha": "$GIT_SHA",
  "app_dir": "$APP_DIR",
  "health_url": "$HEALTH_URL",
  "api_image": "${API_IMAGE}:${RELEASE_ID}",
  "web_image": "${WEB_IMAGE}:${RELEASE_ID}",
  "api_image_id": "$API_ID",
  "web_image_id": "$WEB_ID",
  "frontends": "$DEST/frontends.tar.gz"
}
EOF

ln -sfn "$DEST" "$CURRENT_LINK"
echo "$RELEASE_ID" >"$RELEASES_DIR/CURRENT_ID"

prune_old_releases

echo "==> Release snapshot complete: $DEST"
echo "    Rollback: $SCRIPT_DIR/rollback.sh"
echo "    Or:       $SCRIPT_DIR/rollback.sh $RELEASE_ID"
