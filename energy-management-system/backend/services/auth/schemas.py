import uuid

from backend.common.models import UserRole
from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.CLIENT
    user_id: uuid.UUID | None = None  # If passed during coordinated creation


class LoginRequest(BaseModel):
    username: str
    password: str


class CredentialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    role: UserRole
    is_active: bool


class TokenVerifyRequest(BaseModel):
    token: str


class TokenVerifyResponse(BaseModel):
    valid: bool
    user_id: uuid.UUID | None = None
    username: str | None = None
    role: UserRole | None = None
    error: str | None = None
