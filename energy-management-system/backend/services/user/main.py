import logging
import os
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.auth import require_admin, require_authenticated
from backend.common.models import CurrentUser, MessageResponse, UserRole
from backend.services.user.database import AsyncSessionLocal, Base, engine, get_db
from backend.services.user.models import User
from backend.services.user.schemas import UserCreate, UserInternalCreate, UserResponse, UserUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("user-service")

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
DEVICE_SERVICE_URL = os.getenv("DEVICE_SERVICE_URL", "http://localhost:8003")
ADMIN_DEFAULT_USER = os.getenv("ADMIN_DEFAULT_USER", "admin")
ADMIN_DEFAULT_USER_ID = uuid.UUID(
    os.getenv("ADMIN_DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("User service database tables initialized.")

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == ADMIN_DEFAULT_USER))
        admin = result.scalar_one_or_none()
        if not admin:
            new_admin = User(
                id=ADMIN_DEFAULT_USER_ID,
                username=ADMIN_DEFAULT_USER,
                email="admin@energy.local",
                full_name="System Administrator",
                address="Headquarters",
                role=UserRole.ADMIN.value,
            )
            session.add(new_admin)
            await session.commit()
            logger.info("Default admin profile seeded: %s", ADMIN_DEFAULT_USER)
    yield
    await engine.dispose()


app = FastAPI(
    title="Energy Management - User Management Service",
    description="Microservice responsible for user profile management and CRUD",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "user-service"}


@app.get("/users", response_model=list[UserResponse], tags=["Users"])
async def list_users(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
):
    """Admin only: list all registered user profiles."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@app.post(
    "/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"]
)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: create a new user profile and register credentials in Auth Service."""
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Username '{req.username}' already exists"
        )

    user_id = uuid.uuid4()

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            auth_resp = await client.post(
                f"{AUTH_SERVICE_URL}/auth/register",
                json={
                    "username": req.username,
                    "password": req.password,
                    "role": req.role.value,
                    "user_id": str(user_id),
                },
            )
            if auth_resp.status_code != status.HTTP_201_CREATED:
                detail = auth_resp.json().get(
                    "detail", "Failed to register credentials in Auth Service"
                )
                raise HTTPException(status_code=auth_resp.status_code, detail=detail)
        except httpx.RequestError as e:
            logger.error(f"Error communicating with auth-service: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Auth service unreachable: {e!s}",
            ) from e

    new_user = User(
        id=user_id,
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        address=req.address,
        role=req.role.value,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@app.post(
    "/users/internal",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Internal"],
)
async def create_internal_user_profile(
    req: UserInternalCreate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where((User.id == req.id) | (User.username == req.username))
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    new_user = User(
        id=req.id,
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        address=req.address,
        role=req.role.value,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@app.get("/users/me", response_model=UserResponse, tags=["Users"])
async def get_my_profile(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(require_authenticated)
):
    """Authenticated user: view own profile."""
    stmt = select(User).where(
        (User.id == current_user.user_id) | (User.username == current_user.username)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=current_user.user_id,
            username=current_user.username,
            role=current_user.role.value,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@app.put("/users/me", response_model=UserResponse, tags=["Users"])
async def update_my_profile(
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Authenticated user: update own email, full_name, and address."""
    stmt = select(User).where(
        (User.id == current_user.user_id) | (User.username == current_user.username)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    if req.email is not None:
        user.email = req.email
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.address is not None:
        user.address = req.address
    if req.password:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                await client.put(
                    f"{AUTH_SERVICE_URL}/auth/credentials/{user.id}",
                    json={"password": req.password},
                )
            except httpx.RequestError as exc:
                logger.warning("Could not sync password update to auth-service: %s", exc)

    await db.commit()
    await db.refresh(user)
    return user


@app.get("/users/{user_id}", response_model=UserResponse, tags=["Users"])
async def get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Admin or profile owner: view user profile."""
    if current_user.role != UserRole.ADMIN and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to access this profile"
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found"
        )
    return user


@app.put("/users/{user_id}", response_model=UserResponse, tags=["Users"])
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: update an existing user profile."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found"
        )

    if req.email is not None:
        user.email = req.email
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.address is not None:
        user.address = req.address
    if req.role is not None:
        user.role = req.role.value

    if req.password or req.role:
        payload = {}
        if req.password:
            payload["password"] = req.password
        if req.role:
            payload["role"] = req.role.value
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                await client.put(f"{AUTH_SERVICE_URL}/auth/credentials/{user_id}", json=payload)
            except httpx.RequestError as exc:
                logger.warning("Could not sync credentials update to auth-service: %s", exc)

    await db.commit()
    await db.refresh(user)
    return user


@app.delete("/users/{user_id}", response_model=MessageResponse, tags=["Users"])
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: delete user, delete credentials, and unassign devices."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found"
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.delete(f"{AUTH_SERVICE_URL}/auth/credentials/{user_id}")
        except httpx.RequestError as e:
            logger.warning(f"Could not notify auth-service of user deletion: {e}")

        try:
            await client.post(f"{DEVICE_SERVICE_URL}/devices/unassign-user/{user_id}")
        except httpx.RequestError as e:
            logger.warning(f"Could not notify device-service of user deletion: {e}")

    await db.delete(user)
    await db.commit()
    return MessageResponse(message=f"User '{user.username}' ({user_id}) deleted successfully")
