#!/usr/bin/env bash
# Redeploy the current main commit without another push.
#
#   bash scripts/deploy.sh                  # everything (api, web, all SPAs)
#   bash scripts/deploy.sh api              # API image, migrate, roll
#   bash scripts/deploy.sh frontends        # every SPA + waiter landing
#   bash scripts/deploy.sh frontends admin pos
#   bash scripts/deploy.sh web              # marketing site only
#
# A normal release is just: git push origin main
# That push plans from the diff and deploys on its own.
set -euo pipefail

scope="${1:-all}"
shift || true

case "$scope" in
  all|api|frontends|web|auto) ;;
  *)
    echo "usage: scripts/deploy.sh [all|api|frontends|web|auto] [app ...]" >&2
    exit 2
    ;;
esac

apps=""
if [[ $# -gt 0 ]]; then
  if [[ "$scope" != "frontends" ]]; then
    echo "App names are only valid with: scripts/deploy.sh frontends <app> [app...]" >&2
    exit 2
  fi
  apps="$(IFS=,; echo "$*")"
fi

migrate="auto"
if [[ "$scope" == "all" || "$scope" == "api" ]]; then
  migrate="always"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Pushing to main deploys without this script." >&2
  exit 1
fi

before="$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
gh workflow run deploy.yml --ref main -f scope="$scope" -f apps="$apps" -f migrate="$migrate"
echo "Waiting for the Deploy workflow to appear..."
run_id=""
for _ in $(seq 1 30); do
  sleep 2
  run_id="$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  if [[ -n "$run_id" && "$run_id" != "$before" ]]; then
    break
  fi
  run_id=""
done
if [[ -z "$run_id" ]]; then
  echo "Workflow dispatched. Watch it with: gh run list --workflow deploy.yml" >&2
  exit 0
fi
echo "Watching run ${run_id}"
gh run watch "$run_id" --exit-status
