#!/usr/bin/env bash
# Low-downtime API roll on the VM.
#
# Usage: roll-api.sh <image-ref> <expected-commit|->
# The image must already be tagged (GHCR pull or a local compose build).
# A standby container binds 127.0.0.1:3010, nginx is reloaded onto it, then
# Compose recreates cullinos-api on :3000 and nginx moves back.
# 127.0.0.1:3001 is yatharth-sync-api on this VM, so the standby must not use it.
# If memory is tight or nginx has no API upstream, falls back to an in-place
# recreate (brief downtime). Never edits /opt/cullinos/.env.
set -euo pipefail

IMAGE="${1:?image ref required}"
EXPECT="${2:?expected commit, or - to only check status=ok}"
APP_DIR="${APP_DIR:-/opt/cullinos}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
STANDBY="cullinos-api-next"
STANDBY_PORT=3010
# Nest + Prisma briefly doubles API RSS. Skip the side-by-side roll below this.
MIN_FREE_KB="${ROLL_API_MIN_FREE_KB:-700000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$EXPECT" == "-" ]]; then
  EXPECT=""
fi

log() { echo "==> $*"; }

health_ok() {
  local url="$1"
  python3 - "$url" "$EXPECT" <<'PY'
import json, sys, urllib.request
url, expect = sys.argv[1], sys.argv[2]
try:
    with urllib.request.urlopen(url, timeout=5) as response:
        data = json.loads(response.read().decode())
except Exception:
    sys.exit(1)
if data.get("status") != "ok":
    sys.exit(1)
if expect and data.get("commit") != expect:
    sys.exit(1)
sys.exit(0)
PY
}

wait_health() {
  local url="$1"
  local attempts="${2:-40}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if health_ok "$url"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

compose_recreate() {
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build --force-recreate api
}

in_place() {
  log "Recreating api in place (brief downtime while :3000 rebinds)"
  compose_recreate
  if wait_health "http://127.0.0.1:3000/api/v1/health" 40; then
    log "API healthy on :3000"
    return 0
  fi
  log "API failed health after in-place recreate"
  docker logs --tail 80 cullinos-api 2>&1 || true
  return 1
}

api_confs() {
  local f real
  local -A seen=()
  shopt -s nullglob
  for f in /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
    [[ -f "$f" ]] || continue
    real="$(readlink -f "$f")"
    [[ -n "${seen[$real]:-}" ]] && continue
    if grep -Eq 'upstream[[:space:]]+cullinos_api|proxy_pass[[:space:]]+http://127\.0\.0\.1:(3000|3010)([^0-9]|$)' "$real"; then
      # Marketing web also lives in conf.d; only files that mention the API.
      # Match :3000 and the standby :3010 only. Never :3001 or other ports.
      if grep -Eq 'cullinos_api|proxy_pass[[:space:]]+http://127\.0\.0\.1:(3000|3010)([^0-9]|$)' "$real"; then
        seen["$real"]=1
        echo "$real"
      fi
    fi
  done
}

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Image not present locally: $IMAGE" >&2
  exit 1
fi

if ! docker inspect cullinos-api >/dev/null 2>&1; then
  log "cullinos-api is not running"
  in_place
  exit $?
fi
if [[ "$(docker inspect -f '{{.State.Running}}' cullinos-api)" != "true" ]]; then
  log "cullinos-api is stopped"
  in_place
  exit $?
fi

avail_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
if [[ "${avail_kb:-0}" -lt "$MIN_FREE_KB" ]]; then
  log "MemAvailable ${avail_kb}kB is below ${MIN_FREE_KB}kB; skipping side-by-side roll"
  in_place
  exit $?
fi

mapfile -t CONFS < <(api_confs)
if [[ ${#CONFS[@]} -eq 0 ]]; then
  log "No nginx API upstream found; skipping side-by-side roll"
  in_place
  exit $?
fi

NET="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' cullinos-api | grep -v -E '^(bridge|host|none)$' | head -n1)"
if [[ -z "$NET" ]]; then
  log "Could not read the API network; skipping side-by-side roll"
  in_place
  exit $?
fi

backup_dir="$(mktemp -d)"
cleanup_files() {
  rm -rf "$backup_dir"
  rm -f /tmp/cullinos-api-next.env
}
trap cleanup_files EXIT

for conf in "${CONFS[@]}"; do
  cp -a "$conf" "$backup_dir/$(echo "$conf" | tr '/' '_')"
done

restore_nginx() {
  local conf
  for conf in "${CONFS[@]}"; do
    cp -a "$backup_dir/$(echo "$conf" | tr '/' '_')" "$conf"
  done
  if nginx -t; then
    systemctl reload nginx || true
  fi
}

log "Starting standby ${STANDBY} on 127.0.0.1:${STANDBY_PORT} from ${IMAGE}"
docker rm -f "$STANDBY" >/dev/null 2>&1 || true
# Reuse the VM .env Compose already uses. GIT_COMMIT stays the value baked into
# the image unless .env sets it (it does not). Do not write that file.
if ! python3 - "$IMAGE" "$NET" "$STANDBY" "$STANDBY_PORT" "$APP_DIR/.env" <<'PY'
import json, subprocess, sys

image, network, name, port, env_file = sys.argv[1:]
raw = subprocess.check_output(["docker", "inspect", "cullinos-api"])
info = json.loads(raw)[0]

cmd = [
    "docker", "run", "-d",
    "--name", name,
    "--network", network,
    "--env-file", env_file,
    "--restart", "no",
    "-p", f"127.0.0.1:{port}:3000",
]
for mount in info.get("Mounts") or []:
    dest = mount.get("Destination")
    if not dest:
        continue
    mode = mount.get("Mode") or ""
    readonly = mount.get("RW") is False or "ro" in mode.split(",")
    if mount.get("Type") == "volume" and mount.get("Name"):
        spec = f"type=volume,source={mount['Name']},target={dest}"
    elif mount.get("Type") == "bind" and mount.get("Source"):
        spec = f"type=bind,source={mount['Source']},target={dest}"
    else:
        continue
    if readonly:
        spec += ",readonly"
    cmd.extend(["--mount", spec])
cmd.append(image)
subprocess.check_call(cmd)
PY
then
  echo "Failed to start standby container" >&2
  docker rm -f "$STANDBY" >/dev/null 2>&1 || true
  exit 1
fi
rm -f /tmp/cullinos-api-next.env

if ! wait_health "http://127.0.0.1:${STANDBY_PORT}/api/v1/health" 40; then
  echo "Standby failed health; production is still on the previous container" >&2
  docker logs --tail 80 "$STANDBY" 2>&1 || true
  docker rm -f "$STANDBY" >/dev/null 2>&1 || true
  exit 1
fi
log "Standby healthy"

if ! python3 "$SCRIPT_DIR/nginx_roll.py" "$STANDBY_PORT" "${CONFS[@]}"; then
  echo "Could not retarget nginx; leaving the previous upstream" >&2
  restore_nginx
  docker rm -f "$STANDBY" >/dev/null 2>&1 || true
  exit 1
fi
if ! nginx -t; then
  echo "nginx -t failed after retarget; restoring the previous config" >&2
  restore_nginx
  docker rm -f "$STANDBY" >/dev/null 2>&1 || true
  exit 1
fi
systemctl reload nginx
log "Traffic is on :${STANDBY_PORT}; recreating Compose api on :3000"

if ! compose_recreate; then
  echo "Compose recreate failed. Traffic stays on :${STANDBY_PORT} (${STANDBY})." >&2
  exit 1
fi
if ! wait_health "http://127.0.0.1:3000/api/v1/health" 40; then
  echo "New api on :3000 failed health. Traffic stays on :${STANDBY_PORT} (${STANDBY})." >&2
  docker logs --tail 80 cullinos-api 2>&1 || true
  exit 1
fi

if ! python3 "$SCRIPT_DIR/nginx_roll.py" 3000 "${CONFS[@]}"; then
  echo "Could not move nginx back to :3000. Traffic stays on :${STANDBY_PORT}." >&2
  exit 1
fi
if ! nginx -t; then
  echo "nginx -t failed moving back to :3000. Restoring the standby upstream." >&2
  python3 "$SCRIPT_DIR/nginx_roll.py" "$STANDBY_PORT" "${CONFS[@]}" || true
  nginx -t && systemctl reload nginx || true
  exit 1
fi
systemctl reload nginx
docker rm -f "$STANDBY" >/dev/null 2>&1 || true
log "API rolled with traffic on the standby during recreate"
exit 0
