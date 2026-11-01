import logging
import os

import httpx
from backend.common.models import TokenPayload, UserRole
from backend.common.security import decode_access_token
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-gateway")

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8002")
DEVICE_SERVICE_URL = os.getenv("DEVICE_SERVICE_URL", "http://localhost:8003")

app = FastAPI(
    title="Energy Management - API Gateway & Reverse Proxy",
    description="Unified Entrypoint with token validation and role-based routing",
    version="1.0.0",
)

# Enable CORS for future frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBLIC_PATHS = [
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
]


def extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


@app.get("/health", tags=["Gateway"])
async def health_check():
    return {
        "status": "ok",
        "service": "api-gateway",
        "targets": {
            "auth_service": AUTH_SERVICE_URL,
            "user_service": USER_SERVICE_URL,
            "device_service": DEVICE_SERVICE_URL,
        },
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def gateway_reverse_proxy(path: str, request: Request):
    full_path = f"/{path}"

    # Handle preflight CORS requests immediately
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_200_OK)

    # 1. Determine target downstream microservice
    target_base_url = None
    downstream_path = full_path

    if full_path.startswith("/api/v1/auth/"):
        target_base_url = AUTH_SERVICE_URL
        # Map /api/v1/auth/login -> /auth/login
        downstream_path = full_path.replace("/api/v1/auth", "/auth")
    elif full_path.startswith("/api/v1/users"):
        target_base_url = USER_SERVICE_URL
        # Map /api/v1/users -> /users
        downstream_path = full_path.replace("/api/v1/users", "/users")
    elif full_path.startswith("/api/v1/devices"):
        target_base_url = DEVICE_SERVICE_URL
        # Map /api/v1/devices -> /devices
        downstream_path = full_path.replace("/api/v1/devices", "/devices")
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route '{full_path}' does not match any registered microservice",
        )

    # 2. Check Authentication & Authorization
    user_payload: TokenPayload | None = None
    is_public = any(full_path.startswith(p) for p in PUBLIC_PATHS)

    if not is_public:
        token = extract_bearer_token(request)
        if not token:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing Authorization Bearer token"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_payload = decode_access_token(token)
        if not user_payload:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired Authorization token"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Apply Gateway-level Role-Based Access Control (RBAC)
        # Non-admins cannot perform user CRUD or manage/assign devices
        if user_payload.role != UserRole.ADMIN:
            # Users service: Only /users/me is accessible by Clients
            if downstream_path.startswith("/users") and downstream_path != "/users/me":
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "detail": "Administrator role required for this user management action"
                    },
                )

            # Devices service: Clients can only access /devices/my-devices and GET /devices/{id}
            if downstream_path.startswith("/devices"):
                is_client_allowed = downstream_path == "/devices/my-devices" or (
                    request.method == "GET" and downstream_path.startswith("/devices/")
                )
                if not is_client_allowed:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "Admin role required for device management"},
                    )

    # 3. Forward request to downstream microservice
    body = await request.body()
    headers = dict(request.headers)

    # Remove host header to allow target resolution
    headers.pop("host", None)
    headers.pop("content-length", None)

    # Inject authenticated user context headers
    if user_payload:
        headers["X-User-Id"] = str(user_payload.user_id)
        headers["X-User-Name"] = user_payload.username
        headers["X-User-Role"] = user_payload.role.value

    downstream_url = f"{target_base_url}{downstream_path}"
    query_params = request.url.query

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=downstream_url,
                params=query_params,
                content=body,
                headers=headers,
            )
            # Filter out hop-by-hop headers
            response_headers = {
                k: v
                for k, v in resp.headers.items()
                if k.lower() not in ["content-length", "content-encoding", "transfer-encoding"]
            }
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=response_headers,
                media_type=resp.headers.get("content-type"),
            )
        except httpx.RequestError as exc:
            logger.error(f"Downstream gateway error calling {downstream_url}: {exc}")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": f"Downstream microservice unreachable: {exc!s}"},
            )
