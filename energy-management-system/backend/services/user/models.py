import uuid

from sqlalchemy import Column, DateTime, String, Uuid, func

from backend.services.user.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), nullable=True)
    full_name = Column(String(150), nullable=True)
    address = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="CLIENT")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
