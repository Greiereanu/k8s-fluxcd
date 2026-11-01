import uuid

from backend.services.auth.database import Base
from sqlalchemy import Boolean, Column, DateTime, String, Uuid, func


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="CLIENT")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
