import asyncio
import logging
import uuid
from contextlib import asynccontextmanager, suppress
from datetime import UTC, date, datetime, time

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.models import UserRole
from backend.common.security import decode_access_token
from backend.services.monitoring.consumer import get_device_metadata, run_rabbitmq_consumer
from backend.services.monitoring.database import Base, engine, get_db
from backend.services.monitoring.models import HourlyConsumption
from backend.services.monitoring.schemas import (
    DeviceHourlyHistoryResponse,
    HourlyConsumptionRecord,
)
from backend.services.monitoring.websocket import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monitoring-service")

consumer_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global consumer_task
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Monitoring service database tables initialized.")

    # Start RabbitMQ consumer background task
    consumer_task = asyncio.create_task(run_rabbitmq_consumer())
    logger.info("RabbitMQ consumer task launched in background.")

    yield

    if consumer_task:
        consumer_task.cancel()
        with suppress(asyncio.CancelledError):
            await consumer_task
    await engine.dispose()
    logger.info("Monitoring service shutdown complete.")


app = FastAPI(
    title="Energy Management - Monitoring and Communication Service",
    description="Microservice responsible for energy consumption aggregation and real-time alerts",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": "monitoring-service",
        "consumer_running": consumer_task is not None and not consumer_task.done(),
    }


@app.get(
    "/monitoring/devices/{device_id}/hourly",
    response_model=DeviceHourlyHistoryResponse,
    tags=["Monitoring"],
)
async def get_device_hourly_history(
    device_id: uuid.UUID,
    target_date: str | None = Query(
        None, alias="date", description="Target date in YYYY-MM-DD format"
    ),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve hourly energy consumption history for a device on a specific day."""
    if target_date:
        try:
            query_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Expected YYYY-MM-DD.",
            ) from None
    else:
        query_date = datetime.now(UTC).date()

    start_of_day = datetime.combine(query_date, time.min, tzinfo=UTC)
    end_of_day = datetime.combine(query_date, time.max, tzinfo=UTC)

    stmt = (
        select(HourlyConsumption)
        .where(
            HourlyConsumption.device_id == device_id,
            HourlyConsumption.timestamp_hour >= start_of_day,
            HourlyConsumption.timestamp_hour <= end_of_day,
        )
        .order_by(HourlyConsumption.timestamp_hour.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # Fetch max_consumption limit from device-service
    dev_meta = await get_device_metadata(device_id)
    max_consumption = float(dev_meta["max_consumption"]) if dev_meta else None

    return DeviceHourlyHistoryResponse(
        device_id=device_id,
        max_consumption=max_consumption,
        records=[HourlyConsumptionRecord.model_validate(r) for r in records],
    )


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket, token: str | None = Query(None)):
    """Real-time WebSocket alerts channel for consumption threshold violations."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    user_id = payload.user_id
    is_admin = payload.role == UserRole.ADMIN

    await ws_manager.connect(websocket, user_id=user_id, is_admin=is_admin)

    try:
        # Keep connection open and handle potential ping/pong
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id=user_id)
    except Exception as e:
        logger.warning("WebSocket error for user %s: %s", user_id, e)
        ws_manager.disconnect(websocket, user_id=user_id)
