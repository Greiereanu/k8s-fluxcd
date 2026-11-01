import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    address: str | None = None
    max_consumption: float = Field(
        ..., gt=0.0, description="Maximum hourly/daily energy consumption"
    )
    assigned_user_id: uuid.UUID | None = None
    status: str = "ACTIVE"


class DeviceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    max_consumption: float | None = Field(None, gt=0.0)
    assigned_user_id: uuid.UUID | None = None
    status: str | None = None


class DeviceAssignRequest(BaseModel):
    user_id: uuid.UUID


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    address: str | None = None
    max_consumption: float
    assigned_user_id: uuid.UUID | None = None
    status: str
    created_at: datetime
    updated_at: datetime
