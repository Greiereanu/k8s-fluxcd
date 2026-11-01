import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.models import MessageResponse, TokenResponse, UserRole
from backend.common.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from backend.services.auth.database import AsyncSessionLocal, Base, engine, get_db
from backend.services.auth.models import Credential
from backend.services.auth.schemas import (
    CredentialResponse,
    LoginRequest,
    RegisterRequest,
    TokenVerifyRequest,
    TokenVerifyResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auth-service")

ADMIN_DEFAULT_USER = os.getenv("ADMIN_DEFAULT_USER", "admin")
ADMIN_DEFAULT_PASS = os.getenv("ADMIN_DEFAULT_PASS", "Admin123!")
ADMIN_DEFAULT_USER_ID = uuid.UUID(
    os.getenv("ADMIN_DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Auth service database tables initialized.")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Credential).where(Credential.username == ADMIN_DEFAULT_USER)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            new_admin = Credential(
                id=uuid.uuid4(),
                user_id=ADMIN_DEFAULT_USER_ID,
                username=ADMIN_DEFAULT_USER,
                password_hash=hash_password(ADMIN_DEFAULT_PASS),
                role=UserRole.ADMIN.value,
                is_active=True,
            )
            session.add(new_admin)
            await session.commit()
            logger.info("Default admin user created: %s", ADMIN_DEFAULT_USER)
    yield
    await engine.dispose()


app = FastAPI(
    title="Energy Management - Auth Service",
    description="Authentication and Token Authorization Microservice",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "auth-service"}


@app.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Credential).where(Credential.username == req.username)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{req.username}' is already registered",
        )

    user_id = req.user_id or uuid.uuid4()
    new_cred = Credential(
        id=uuid.uuid4(),
        user_id=user_id,
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role.value,
        is_active=True,
    )
    db.add(new_cred)
    await db.commit()
    await db.refresh(new_cred)

    access_token = create_access_token(
        user_id=new_cred.user_id, username=new_cred.username, role=UserRole(new_cred.role)
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=new_cred.user_id,
        username=new_cred.username,
        role=UserRole(new_cred.role),
    )


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Credential).where(Credential.username == req.username)
    result = await db.execute(stmt)
    cred = result.scalar_one_or_none()

    if not cred or not verify_password(req.password, cred.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not cred.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token = create_access_token(
        user_id=cred.user_id, username=cred.username, role=UserRole(cred.role)
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=cred.user_id,
        username=cred.username,
        role=UserRole(cred.role),
    )


@app.post("/auth/verify", response_model=TokenVerifyResponse, tags=["Auth"])
async def verify_token(req: TokenVerifyRequest):
    token_payload = decode_access_token(req.token)
    if not token_payload:
        return TokenVerifyResponse(valid=False, error="Invalid or expired token")

    return TokenVerifyResponse(
        valid=True,
        user_id=token_payload.user_id,
        username=token_payload.username,
        role=token_payload.role,
    )


@app.get("/auth/credentials", response_model=list[CredentialResponse], tags=["Internal"])
async def list_credentials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Credential))
    return result.scalars().all()


@app.delete("/auth/credentials/{user_id}", response_model=MessageResponse, tags=["Internal"])
async def delete_credential(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Credential).where(Credential.user_id == user_id))
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Credential for user_id '{user_id}' not found",
        )
    await db.commit()
    return MessageResponse(message=f"Credentials for user_id '{user_id}' deleted successfully")
