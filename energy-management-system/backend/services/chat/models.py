import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import relationship

from backend.services.chat.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(Uuid(as_uuid=True), unique=True, index=True, nullable=False)
    client_username = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.timestamp.asc()",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sender_id = Column(Uuid(as_uuid=True), nullable=False)
    sender_username = Column(String(100), nullable=False)
    sender_role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("ChatSession", back_populates="messages")
