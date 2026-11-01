import os
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from backend.common.models import TokenPayload, UserRole

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-energy-management-system-key-2026")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    user_id: uuid.UUID | str,
    username: str,
    role: UserRole | str,
    expires_delta: timedelta | None = None,
) -> str:
    role_str = role.value if isinstance(role, UserRole) else str(role)
    user_id_str = str(user_id)
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": user_id_str,
        "user_id": user_id_str,
        "username": username,
        "role": role_str,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> TokenPayload | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        raw_uid = payload.get("user_id") or payload.get("sub")
        return TokenPayload(
            user_id=uuid.UUID(str(raw_uid)),
            username=str(payload.get("username")),
            role=UserRole(payload.get("role")),
            exp=payload.get("exp"),
            iat=payload.get("iat"),
        )
    except Exception:
        return None
