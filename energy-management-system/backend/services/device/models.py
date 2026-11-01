import uuid

from sqlalchemy import Column, DateTime, Float, String, Uuid, func

from backend.services.device.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    address = Column(String(255), nullable=True)
    max_consumption = Column(Float, nullable=False)
    assigned_user_id = Column(Uuid(as_uuid=True), index=True, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
