#!/usr/bin/env bash
# One-command app rollback (API + web images + static frontends). Does NOT restore DB.
# Usage (on VM as root):
#   /opt/cullinos/scripts/prod/rollback.sh           # previous release
#   /opt/cullinos/scripts/prod/rollback.sh <id>      # named release
#   /opt/cullinos/scripts/prod/rollback.sh --list
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

list_releases() {
  mkdir -p "$RELEASES_DIR"
  echo "Available releases (newest first):"
  local current_id="" previous_id=""
  [[ -f "$RELEASES_DIR/CURRENT_ID" ]] && current_id="$(cat "$RELEASES_DIR/CURRENT_ID")"
  if [[ -L "$PREVIOUS_LINK" ]]; then
    previous_id="$(basename "$(readlink -f "$PREVIOUS_LINK")")"
  fi
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
  if [[ ${#releases[@]} -eq 0 ]]; then
    echo "  (none — run snapshot-release.sh after a successful deploy)"
    return
  fi
  local id
  for id in "${releases[@]}"; do
    local mark=""
    [[ "$id" == "$current_id" ]] && mark=" [current]"
    [[ "$id" == "$previous_id" ]] && mark="${mark} [previous]"
    echo "  $id$mark"
  done
}

resolve_target() {
  local arg="${1:-}"
  if [[ -n "$arg" ]]; then
    if [[ -d "$RELEASES_DIR/$arg" ]]; then
      echo "$arg"
      return
    fi
    echo "Release not found: $arg" >&2
    list_releases >&2
    exit 1
  fi
  if [[ -L "$PREVIOUS_LINK" && -d "$(readlink -f "$PREVIOUS_LINK")" ]]; then
    basename "$(readlink -f "$PREVIOUS_LINK")"
    return
  fi
  # Fallback: second-newest directory
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
  if [[ ${#releases[@]} -ge 2 ]]; then
    echo "${releases[1]}"
    return
  fi
  echo "No previous release to roll back to. Run snapshot-release.sh after deploys." >&2
  list_releases >&2
  exit 1
}

apply_release() {
  local release_id="$1"
  local dest="$RELEASES_DIR/$release_id"
  local override="$dest/docker-compose.release.yml"

  if [[ ! -f "$override" ]]; then
    write_compose_override_images \
      "$override" \
      "${API_IMAGE}:${release_id}" \
      "${WEB_IMAGE}:${release_id}"
  fi

  if ! docker image inspect "${API_IMAGE}:${release_id}" >/dev/null 2>&1; then
    echo "Missing image ${API_IMAGE}:${release_id}" >&2
    exit 1
  fi
  if ! docker image inspect "${WEB_IMAGE}:${release_id}" >/dev/null 2>&1; then
    echo "Missing image ${WEB_IMAGE}:${release_id}" >&2
    exit 1
  fi

  docker tag "${API_IMAGE}:${release_id}" "${API_IMAGE}:current"
  docker tag "${WEB_IMAGE}:${release_id}" "${WEB_IMAGE}:current"

  echo "==> Stopping api + web"
  compose stop api web || true

  echo "==> Starting release $release_id (no rebuild)"
  docker compose -f "$COMPOSE_FILE" -f "$override" up -d --no-build api web

  if [[ -f "$dest/frontends.tar.gz" ]]; then
    echo "==> Restoring frontends to $WWW_DIR"
    mkdir -p "$(dirname "$WWW_DIR")"
    rm -rf "$WWW_DIR"
    tar -C "$(dirname "$WWW_DIR")" -xzf "$dest/frontends.tar.gz"
  else
    echo "Warning: no frontends.tar.gz in release — SPA files unchanged." >&2
  fi

  if command -v nginx >/dev/null 2>&1; then
    nginx -t && systemctl reload nginx || true
  fi
}

if [[ "${1:-}" == "--list" || "${1:-}" == "-l" ]]; then
  list_releases
  exit 0
fi

TARGET_ID="$(resolve_target "${1:-}")"
FROM_ID=""
[[ -f "$RELEASES_DIR/CURRENT_ID" ]] && FROM_ID="$(cat "$RELEASES_DIR/CURRENT_ID")"

echo "==> Rolling back app to release: $TARGET_ID"
[[ -n "$FROM_ID" ]] && echo "    (was current: $FROM_ID)"
echo "    Note: Postgres/Redis are NOT restored. Use restore-backup.sh for data."

apply_release "$TARGET_ID"

echo "==> Waiting for API health..."
if wait_health 36; then
  echo "==> Health OK"
  # Promote CURRENT / PREVIOUS pointers
  if [[ -n "$FROM_ID" && -d "$RELEASES_DIR/$FROM_ID" && "$FROM_ID" != "$TARGET_ID" ]]; then
    ln -sfn "$RELEASES_DIR/$FROM_ID" "$PREVIOUS_LINK"
  fi
  ln -sfn "$RELEASES_DIR/$TARGET_ID" "$CURRENT_LINK"
  echo "$TARGET_ID" >"$RELEASES_DIR/CURRENT_ID"
  echo "==> Rollback complete: $TARGET_ID"
  exit 0
fi

echo "==> Health check FAILED after rollback to $TARGET_ID" >&2
if [[ -n "$FROM_ID" && "$FROM_ID" != "$TARGET_ID" && -d "$RELEASES_DIR/$FROM_ID" ]]; then
  echo "==> Attempting best-effort restore of previous current: $FROM_ID" >&2
  apply_release "$FROM_ID" || true
  if wait_health 24; then
    ln -sfn "$RELEASES_DIR/$FROM_ID" "$CURRENT_LINK"
    echo "$FROM_ID" >"$RELEASES_DIR/CURRENT_ID"
    echo "==> Restored $FROM_ID after failed rollback." >&2
  else
    echo "==> Could not restore $FROM_ID either — check docker logs." >&2
  fi
fi
exit 1
