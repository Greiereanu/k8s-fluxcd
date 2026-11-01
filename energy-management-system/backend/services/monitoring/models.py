import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, UniqueConstraint, Uuid, func

from backend.services.monitoring.database import Base


class HourlyConsumption(Base):
    __tablename__ = "hourly_consumption"
    __table_args__ = (
        UniqueConstraint("device_id", "timestamp_hour", name="uq_device_hourly_bucket"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(Uuid(as_uuid=True), index=True, nullable=False)
    timestamp_hour = Column(DateTime(timezone=True), index=True, nullable=False)
    total_consumption = Column(Float, nullable=False, default=0.0)
    measurement_count = Column(Integer, nullable=False, default=0)
    alert_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
