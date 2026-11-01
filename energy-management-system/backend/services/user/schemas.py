import uuid
from datetime import datetime

from backend.common.models import UserRole
from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: str | None = None
    full_name: str | None = None
    address: str | None = None
    role: UserRole = UserRole.CLIENT


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    address: str | None = None
    role: UserRole | None = None


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
