#!/usr/bin/env bash
# Migrate Postgres data from Docker Compose into the k3s production Postgres PVC.
# Run on the VM during a maintenance window AFTER:
#   - k3s installed
#   - production overlay applied (postgres pod Ready)
#   - Compose stack still running (source of truth dump)
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="${NS:-production}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/cullinos}"
DUMP_FILE="${DUMP_FILE:-/tmp/cullinos-compose-migrate-$(date +%Y%m%d%H%M%S).sql}"

echo "==> Dumping Compose Postgres"
cd "$COMPOSE_DIR"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U cullinos -d cullinos --clean --if-exists > "$DUMP_FILE"
ls -lh "$DUMP_FILE"

echo "==> Waiting for k8s postgres in namespace ${NS}"
kubectl -n "$NS" wait --for=condition=ready pod -l app=postgres --timeout=180s

PG_POD="$(kubectl -n "$NS" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')"
echo "Target pod: $PG_POD"

echo "==> Restoring into k8s Postgres (destroys existing DB objects in target)"
kubectl -n "$NS" exec -i "$PG_POD" -- \
  psql -U cullinos -d cullinos < "$DUMP_FILE"

echo "==> Done. Verify row counts, then cut ingress DNS to Traefik (see cutover-checklist.md)."
echo "Dump kept at: $DUMP_FILE"
