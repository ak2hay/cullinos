#!/usr/bin/env bash
# Build all Vite frontends for VM deployment (run from repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export VITE_API_URL="${VITE_API_URL:-https://api.cullinos.com/api/v1}"
export VITE_WS_URL="${VITE_WS_URL:-https://api.cullinos.com}"
export VITE_KDS_URL="${VITE_KDS_URL:-https://kds.cullinos.com}"
export VITE_POS_URL="${VITE_POS_URL:-https://pos.cullinos.com}"
export VITE_KIOSK_APP_URL="${VITE_KIOSK_APP_URL:-https://kiosk.cullinos.com}"
export VITE_ADMIN_URL="${VITE_ADMIN_URL:-https://admin.cullinos.com}"
export VITE_MARKETING_WEB_URL="${VITE_MARKETING_WEB_URL:-https://cullinos.com}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.cullinos.com/api/v1}"


echo ">>> Building shared packages"
npm run build -w @cullinos/shared -w @cullinos/ui

APPS=(admin management super-admin app-ops pos kds kiosk)

for app in "${APPS[@]}"; do
  echo ">>> Building @cullinos/$app"
  npm run build -w "@cullinos/$app"
done

echo ">>> Building @cullinos/web (Next.js marketing)"
npm run build -w @cullinos/web

OUT="${ROOT}/dist-frontends"
rm -rf "$OUT"
mkdir -p "$OUT"

for app in "${APPS[@]}"; do
  src="${ROOT}/apps/${app}/dist"
  if [[ ! -d "$src" ]]; then
    echo "Missing dist for $app" >&2
    exit 1
  fi
  cp -r "$src" "${OUT}/${app}"
done

# Static landings for decommissioned web portals (Android apps)
mkdir -p "${OUT}/guest-landing" "${OUT}/waiter-landing"
cp -r "${ROOT}/infrastructure/www/guest-landing/." "${OUT}/guest-landing/"
cp -r "${ROOT}/infrastructure/www/waiter-landing/." "${OUT}/waiter-landing/"

echo "Frontend bundles ready in dist-frontends/"
echo "Deploy to VM: rsync dist-frontends/* to /var/www/cullinos/"
