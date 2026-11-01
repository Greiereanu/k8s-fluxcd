# k8s Observability & Traefik Stack on k3d

This repository contains declarative configurations and Helm value overrides to deploy **Traefik**, **kube-prometheus-stack**, **Grafana Loki**, and **Grafana Tempo** on a local **k3d** cluster.

---

## 1. Web Endpoints

All services are accessible locally via both HTTP (`http://*.localhost`) and trusted HTTPS (`https://*.localhost`):

| Component | URL (HTTPS) | Notes / Credentials |
| :--- | :--- | :--- |
| **Grafana** | [https://grafana.localhost](https://grafana.localhost) | User: `admin` \| Password: `admin` |
| **Traefik Dashboard** | [https://traefik.localhost/dashboard/](https://traefik.localhost/dashboard/) | Traefik v3 Web UI & Ingress overview |
| **Prometheus** | [https://prometheus.localhost](https://prometheus.localhost) | Scrapes Traefik, K8s nodes, kubelet, and pods |
| **Alertmanager** | [https://alertmanager.localhost](https://alertmanager.localhost) | Alerts routing & notification manager |
| **Demo Application** | [https://demo.localhost](https://demo.localhost) | Sample workload for end-to-end testing |

---

## 2. Pre-Configured Grafana Datasources

Grafana is provisioned with all three pillars of observability:

1. **Metrics (Prometheus)**: `http://kube-prometheus-stack-prometheus.monitoring:9090/` (Default)
2. **Logs (Grafana Loki)**: `http://loki-gateway.monitoring.svc.cluster.local` (Structured access logs + pod stdout logs)
3. **Traces (Grafana Tempo)**: `http://tempo.monitoring.svc.cluster.local:3200` (OTLP gRPC traces from Traefik & workloads)

---

## 3. Directory Structure

```
.
├── cluster/
│   ├── k3d-config.yaml              # k3d cluster specification with port mappings & disabled default Traefik
│   └── kubeconfig.yaml              # Cluster kubeconfig
├── helm/
│   ├── traefik/
│   │   └── values.yaml              # Traefik v3 chart values (JSON logs, OTLP tracing, Prometheus ServiceMonitor)
│   ├── kube-prometheus-stack/
│   │   └── values.yaml              # Prometheus Operator (with enableRemoteWriteReceiver), Grafana ingress, and datasources
│   ├── loki/
│   │   └── values.yaml              # Loki SingleBinary configuration with filesystem storage
│   ├── promtail/
│   │   └── values.yaml              # Promtail DaemonSet log shipper configuration
│   └── tempo/
│       └── values.yaml              # Tempo SingleBinary with metrics-generator (span-metrics, service-graphs, local-blocks)
├── dashboards/
│   └── traefik.json                 # Traefik official Grafana dashboard
└── apps/
    └── demo-app.yaml                # Sample HTTP echo deployment, service, and ingress
```

---

## 4. Re-creating or Starting the Cluster

To recreate the cluster from scratch:

```bash
# 1. Create the k3d cluster
k3d cluster create --config cluster/k3d-config.yaml
k3d kubeconfig get local-cluster > ~/.kube/config

# 2. Add Helm repositories
helm repo add traefik https://traefik.github.io/charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 3. Create namespaces
kubectl create ns monitoring
kubectl create ns traefik

# 4. Deploy kube-prometheus-stack
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring -f helm/kube-prometheus-stack/values.yaml

# 5. Deploy Loki, Promtail, and Tempo
helm install loki grafana/loki -n monitoring -f helm/loki/values.yaml
helm install promtail grafana/promtail -n monitoring -f helm/promtail/values.yaml
helm install tempo grafana/tempo -n monitoring -f helm/tempo/values.yaml

# 6. Deploy Traefik
helm install traefik traefik/traefik -n traefik -f helm/traefik/values.yaml

# 7. Deploy Demo Application
kubectl apply -f apps/demo-app.yaml
```

