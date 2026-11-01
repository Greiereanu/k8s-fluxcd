import asyncio
import json
import logging
import os
import time
import uuid
from datetime import UTC, datetime

import aio_pika
import httpx
from sqlalchemy import select

from backend.services.monitoring.database import AsyncSessionLocal
from backend.services.monitoring.models import HourlyConsumption
from backend.services.monitoring.schemas import AlertNotification
from backend.services.monitoring.websocket import ws_manager

logger = logging.getLogger("monitoring-service.consumer")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
DEVICE_SERVICE_URL = os.getenv("DEVICE_SERVICE_URL", "http://localhost:8003")
EXCHANGE_NAME = os.getenv("RABBITMQ_EXCHANGE", "sensor_exchange")
QUEUE_NAME = os.getenv("RABBITMQ_QUEUE", "monitoring_sensor_queue")
ROUTING_KEY = os.getenv("RABBITMQ_ROUTING_KEY", "sensor.reading")

device_cache: dict[uuid.UUID, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = 30.0


async def get_device_metadata(device_id: uuid.UUID) -> dict | None:
    now = time.monotonic()
    if device_id in device_cache:
        cached_time, meta = device_cache[device_id]
        if now - cached_time < CACHE_TTL_SECONDS:
            return meta

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{DEVICE_SERVICE_URL}/devices/internal/{device_id}")
            if resp.status_code == 200:
                meta = resp.json()
                device_cache[device_id] = (now, meta)
                return meta
            logger.warning("Device metadata lookup returned %d for %s", resp.status_code, device_id)
    except Exception as e:
        logger.warning("Failed to fetch device metadata for %s: %s", device_id, e)

    return None


async def process_sensor_message(body: bytes):
    try:
        data = json.loads(body.decode())
        device_id = uuid.UUID(str(data["device_id"]))
        raw_timestamp = data.get("timestamp")
        measurement_value = float(data.get("measurement_value", 0.0))

        ts = datetime.fromisoformat(raw_timestamp) if raw_timestamp else datetime.now(UTC)

        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)

        # Truncate to the start of the hour
        hour_bucket = ts.replace(minute=0, second=0, microsecond=0)

        async with AsyncSessionLocal() as session:
            stmt = select(HourlyConsumption).where(
                HourlyConsumption.device_id == device_id,
                HourlyConsumption.timestamp_hour == hour_bucket,
            )
            res = await session.execute(stmt)
            record = res.scalar_one_or_none()

            if record is None:
                record = HourlyConsumption(
                    id=uuid.uuid4(),
                    device_id=device_id,
                    timestamp_hour=hour_bucket,
                    total_consumption=round(measurement_value, 4),
                    measurement_count=1,
                    alert_sent=False,
                )
                session.add(record)
            else:
                record.total_consumption = round(record.total_consumption + measurement_value, 4)
                record.measurement_count += 1

            # Check threshold against device's max_consumption
            dev_meta = await get_device_metadata(device_id)
            if dev_meta:
                max_consumption = float(dev_meta.get("max_consumption", 0.0))
                device_name = dev_meta.get("name", "Smart Meter")
                raw_user_id = dev_meta.get("assigned_user_id")
                assigned_user_id = uuid.UUID(raw_user_id) if raw_user_id else None

                if record.total_consumption > max_consumption and not record.alert_sent:
                    alert_msg = (
                        f"Device '{device_name}' exceeded hourly limit of {max_consumption} kWh "
                        f"(current: {round(record.total_consumption, 3)} kWh)"
                    )
                    alert = AlertNotification(
                        type="CONSUMPTION_LIMIT_EXCEEDED",
                        device_id=device_id,
                        device_name=device_name,
                        user_id=assigned_user_id,
                        hour=hour_bucket,
                        current_consumption=round(record.total_consumption, 3),
                        max_consumption=max_consumption,
                        timestamp=datetime.now(UTC),
                        message=alert_msg,
                    )
                    logger.warning(
                        "Overconsumption Alert: device='%s' user='%s' current=%.3f max=%.3f",
                        device_name,
                        assigned_user_id,
                        record.total_consumption,
                        max_consumption,
                    )
                    await ws_manager.dispatch_alert(alert)
                    record.alert_sent = True

            await session.commit()
            logger.info(
                "Aggregated reading: device=%s hour=%s total=%.3f kWh (count=%d)",
                device_id,
                hour_bucket.strftime("%Y-%m-%d %H:%M"),
                record.total_consumption,
                record.measurement_count,
            )

    except Exception as exc:
        logger.error("Error processing sensor message: %s", exc, exc_info=True)


async def run_rabbitmq_consumer():
    logger.info("Initializing RabbitMQ consumer at %s...", RABBITMQ_URL)
    while True:
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=20)

                exchange = await channel.declare_exchange(
                    EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
                )
                queue = await channel.declare_queue(QUEUE_NAME, durable=True)
                await queue.bind(exchange, routing_key=ROUTING_KEY)

                logger.info(
                    "RabbitMQ consumer listening on queue '%s' (bound to exchange '%s' key '%s')",
                    QUEUE_NAME,
                    EXCHANGE_NAME,
                    ROUTING_KEY,
                )

                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        async with message.process():
                            await process_sensor_message(message.body)

        except asyncio.CancelledError:
            logger.info("RabbitMQ consumer task cancelled.")
            break
        except Exception as e:
            logger.warning("RabbitMQ consumer connection lost (%s). Retrying in 5 seconds...", e)
            await asyncio.sleep(5.0)
