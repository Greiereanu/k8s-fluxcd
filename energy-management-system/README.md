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

## 2. Interactive Swagger / OpenAPI Documentation

Once the containers are running, you can explore and test the interactive OpenAPI documentation for each service:

- **API Gateway**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Auth Service**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **User Service**: [http://localhost:8002/docs](http://localhost:8002/docs)
- **Device Service**: [http://localhost:8003/docs](http://localhost:8003/docs)

---

## 3. Quick Start with Docker Compose

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

## 4. Running Code Quality & Linting

Code formatting and linting are strictly enforced with **Ruff**:

```bash
# Run format & lint check
ruff format energy-management-system/
ruff check --fix energy-management-system/
```

---

## 5. End-to-End Automated Testing

A complete integration suite testing authentication, authorization, role isolation, device assignment, and cascade deletion is included:

```bash
docker exec -i ems-api-gateway python3 < energy-management-system/tests/test_backend.py
```
