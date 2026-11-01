import uuid
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    CLIENT = "CLIENT"


class TokenPayload(BaseModel):
    user_id: uuid.UUID
    username: str
    role: UserRole
    exp: int | None = None
    iat: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    username: str
    role: UserRole


class CurrentUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    username: str
    role: UserRole


class MessageResponse(BaseModel):
    message: str
