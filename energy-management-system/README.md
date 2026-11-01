# Energy Management System (EMS) - Backend Microservices

A distributed, loosely coupled Energy Management System designed to monitor and manage smart energy metering devices with role-based access control (Admin & Client).

---

## 1. Architecture & Services

The system is organized as a database-per-service microservice architecture:

| Service | Port | Database | Description |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `8000` | — | Reverse proxy, token verification, and role-based request filtering |
| **Auth Service** | `8001` | `auth_db` | User authentication, registration, password hashing (`bcrypt`), JWT token issuance |
| **User Service** | `8002` | `user_db` | User account CRUD (Admin) & self-profile inspection (Client) |
| **Device Service** | `8003` | `device_db` | Metering device CRUD (Admin), device-to-user assignment, and assigned device views (Client) |
| **PostgreSQL** | `5432` | Multiple | Hosts `auth_db`, `user_db`, and `device_db` |

All IDs (`user_id`, `device_id`, `id`) are strictly generated and stored as **UUIDs**.

---

## 2. Kubernetes Deployment (k3d / Traefik Ingress)

The system is deployed to the local Kubernetes cluster inside the `ems` namespace, fronted by Traefik Ingress.

### Apply Manifests

```bash
kubectl apply -f energy-management-system/k8s/
```

### Endpoints (via Traefik Ingress)

- **HTTPS (Trusted Wildcard TLS)**: [https://ems.localhost](https://ems.localhost)
- **HTTP**: [http://ems.localhost](http://ems.localhost)
- **Gateway Health Check**: [https://ems.localhost/health](https://ems.localhost/health)
- **Swagger / OpenAPI Documentation**: [https://ems.localhost/docs](https://ems.localhost/docs)

### Verification

```bash
kubectl get pods,services,ingress -n ems
```

---

## 3. Alternative Local Run (Docker Compose)

```bash
cd energy-management-system

# Build and start all 5 containers
docker compose up -d --build

# Inspect running containers
docker compose ps
```

### Default Credentials
- **Admin Username**: `admin`
- **Admin Password**: `Admin123!`

---

## 4. Code Quality & Linting

Code formatting and linting are enforced with **Ruff**:

```bash
ruff format energy-management-system/
ruff check --fix energy-management-system/
```

---

## 5. End-to-End Automated Testing

An automated integration suite testing authentication, authorization, role isolation, device assignment, and cascade deletion is included.

### Test against Kubernetes Cluster (Traefik Ingress):

```bash
docker run --rm --net=host -e GATEWAY_URL="https://ems.localhost" -v $(pwd)/energy-management-system/tests:/tests ems-backend:v1 python3 /tests/test_backend.py
```

### Test against Docker Compose Gateway:

```bash
docker exec -i ems-api-gateway python3 < energy-management-system/tests/test_backend.py
```
