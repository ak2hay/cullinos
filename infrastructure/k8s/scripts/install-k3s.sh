#!/usr/bin/env bash
# Install k3s on the Cullinos OnLiveServer VM (run as root on the VM).
# Safe to re-run. Does NOT stop Docker Compose or nginx — follow cutover-checklist.md.
# servicelb is disabled, so Traefik does not bind host :80/:443 and nginx keeps serving production.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

K3S_VERSION="${K3S_VERSION:-v1.29.9+k3s1}"
PUBLIC_IP="${PUBLIC_IP:-95.135.254.46}"
MIN_FREE_GB="${MIN_FREE_GB:-10}"

free_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
if (( free_gb < MIN_FREE_GB )); then
  echo "Only ${free_gb}G free on /; need ${MIN_FREE_GB}G for k3s images alongside Docker." >&2
  echo "Free space first (docker system df; docker image prune), or override MIN_FREE_GB." >&2
  exit 1
fi
echo "==> ${free_gb}G free on /"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  echo "==> ufw: allow k3s pod/service networks and the API server"
  ufw allow from 10.42.0.0/16 to any comment 'k3s pods'
  ufw allow from 10.43.0.0/16 to any comment 'k3s services'
  ufw allow 6443/tcp comment 'k3s API (GitHub Actions deploys)'
fi

echo "==> Installing k3s ${K3S_VERSION}"
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - \
  --write-kubeconfig-mode 600 \
  --disable=servicelb \
  --tls-san "$(hostname -I | awk '{print $1}')" \
  --tls-san "${PUBLIC_IP}"

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl wait --for=condition=Ready nodes --all --timeout=120s

echo "==> Cluster ready"
kubectl get nodes -o wide
kubectl get pods -A

echo ""
echo "Next:"
echo "  1. Create the namespace-scoped deploy kubeconfig for GitHub Actions (never use the admin k3s.yaml):"
echo "       bash create-deploy-kubeconfig.sh production"
echo "     and store the printed file as the 'production' environment secret KUBE_CONFIG."
echo "  2. Leave repo variable K8S_DEPLOY_ENABLED unset until the cutover (cutover-checklist.md)."
