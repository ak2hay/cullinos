# Kubernetes (k3s) manifests

Free-stack layout for Cullinos on the OnLiveServer VM.

```
base/                 Shared Deployments, Services, Ingress, PVCs
overlays/staging/     staging namespace + staging-* hosts + lighter resources
overlays/production/  production namespace + prod hosts
monitoring/           Prometheus + Grafana
scripts/              install-k3s, migrate-from-compose, monitoring, cutover checklist
secrets.example.env   Keys for GitHub *_APP_SECRETS_ENV
```

Apply:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl apply -k overlays/staging
kubectl apply -k overlays/production
bash scripts/install-monitoring.sh
```

See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) and [scripts/cutover-checklist.md](scripts/cutover-checklist.md).
