import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HourlyConsumptionRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID
    timestamp_hour: datetime
    total_consumption: float
    measurement_count: int
    alert_sent: bool


class DeviceHourlyHistoryResponse(BaseModel):
    device_id: uuid.UUID
    max_consumption: float | None = None
    records: list[HourlyConsumptionRecord]


class AlertNotification(BaseModel):
    type: str = "CONSUMPTION_LIMIT_EXCEEDED"
    device_id: uuid.UUID
    device_name: str
    user_id: uuid.UUID | None
    hour: datetime
    current_consumption: float
    max_consumption: float
    timestamp: datetime
    message: str
