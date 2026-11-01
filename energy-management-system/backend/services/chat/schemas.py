import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    sender_id: uuid.UUID
    sender_username: str
    sender_role: str
    content: str
    is_read: bool
    timestamp: datetime


class ChatMessageCreate(BaseModel):
    content: str


class ChatSessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_user_id: uuid.UUID
    client_username: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_message: ChatMessageResponse | None = None
    unread_count: int = 0


class ChatSessionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_user_id: uuid.UUID
    client_username: str
    is_active: bool
    messages: list[ChatMessageResponse] = []
