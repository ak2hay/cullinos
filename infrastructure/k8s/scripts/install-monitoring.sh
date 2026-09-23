#!/usr/bin/env bash
# Apply lightweight Prometheus + Grafana stack.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
kubectl apply -f "$ROOT/monitoring/stack.yaml"
echo "Set Grafana password: kubectl -n monitoring edit secret grafana-admin"
echo "DNS: grafana.cullinos.com → VM IP"
kubectl -n monitoring rollout status deployment/prometheus --timeout=180s || true
kubectl -n monitoring rollout status deployment/grafana --timeout=180s || true
