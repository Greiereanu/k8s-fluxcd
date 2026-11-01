import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.common.models import UserRole


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: str | None = None
    full_name: str | None = None
    address: str | None = None
    role: UserRole = UserRole.CLIENT


class UserInternalCreate(BaseModel):
    id: uuid.UUID
    username: str
    role: UserRole = UserRole.CLIENT
    email: str | None = None
    full_name: str | None = None
    address: str | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    address: str | None = None
    role: UserRole | None = None
    password: str | None = Field(None, min_length=6, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str | None = None
    full_name: str | None = None
    address: str | None = None
    role: UserRole
    created_at: datetime
    updated_at: datetime
