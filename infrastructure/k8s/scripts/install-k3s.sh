#!/usr/bin/env bash
# Install k3s on the Cullinos OnLiveServer VM (run as root on the VM).
# Safe to re-run. Does NOT stop Docker Compose — follow cutover-checklist.md.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

K3S_VERSION="${K3S_VERSION:-v1.29.9+k3s1}"

echo "==> Installing k3s ${K3S_VERSION} (Traefik enabled, serves :80/:443)"
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - \
  --write-kubeconfig-mode 644 \
  --disable=servicelb \
  --tls-san "$(hostname -I | awk '{print $1}')" \
  --tls-san 95.135.254.46

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl wait --for=condition=Ready nodes --all --timeout=120s

echo "==> Cluster ready"
kubectl get nodes -o wide
kubectl get pods -A

echo ""
echo "Next:"
echo "  1. Copy kubeconfig for GitHub Actions:"
echo "       cat /etc/rancher/k3s/k3s.yaml | base64 -w0"
echo "     Store as repo secret KUBE_CONFIG (base64). Fix server URL to https://95.135.254.46:6443"
echo "  2. Open firewall TCP 6443 (GitHub Actions) and keep 80/443 for Traefik."
echo "  3. Follow infrastructure/k8s/scripts/cutover-checklist.md"
echo "  4. Apply staging first: kubectl apply -k /opt/cullinos/infrastructure/k8s/overlays/staging"
