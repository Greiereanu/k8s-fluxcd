import uuid

from pydantic import BaseModel, ConfigDict, Field

from backend.common.models import UserRole


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.CLIENT
    user_id: uuid.UUID | None = None
    email: str | None = None
    full_name: str | None = None
    address: str | None = None


class CredentialUpdate(BaseModel):
    password: str | None = Field(None, min_length=6, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None


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
