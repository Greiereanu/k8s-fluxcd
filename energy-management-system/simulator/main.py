import json
import logging
import os
import signal
import sys
import time
from datetime import UTC, datetime

import httpx
import pika
from generator import SensorLoadSimulator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (sensor-simulator) %(message)s",
)
logger = logging.getLogger("sensor-simulator")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
DEVICE_SERVICE_URL = os.getenv("DEVICE_SERVICE_URL", "http://localhost:8003")
SIMULATION_INTERVAL = float(os.getenv("SIMULATION_INTERVAL_SECONDS", "3.0"))
EXCHANGE_NAME = os.getenv("RABBITMQ_EXCHANGE", "sensor_exchange")
ROUTING_KEY = os.getenv("RABBITMQ_ROUTING_KEY", "sensor.reading")
ENABLE_SPIKES = os.getenv("ENABLE_SPIKES", "true").lower() in ("true", "1", "yes")
SPIKE_EVERY = int(os.getenv("SPIKE_EVERY", "8"))

running = True


def handle_shutdown(signum, frame):
    global running
    logger.info("Shutdown signal received (%s). Stopping simulator...", signum)
    running = False


signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)


def connect_rabbitmq(
    url: str, max_retries: int = 30, retry_delay: float = 2.0
) -> pika.BlockingConnection:
    logger.info("Connecting to RabbitMQ at %s...", url)
    params = pika.URLParameters(url)
    params.socket_timeout = 5

    for attempt in range(1, max_retries + 1):
        try:
            connection = pika.BlockingConnection(params)
            logger.info("Connected to RabbitMQ successfully on attempt %d.", attempt)
            return connection
        except Exception as err:
            logger.warning(
                "RabbitMQ connection attempt %d failed: %s. Retrying in %ss...",
                attempt,
                err,
                retry_delay,
            )
            time.sleep(retry_delay)

    logger.error("Failed to connect to RabbitMQ after %d attempts. Exiting.", max_retries)
    sys.exit(1)


def fetch_active_devices(client: httpx.Client) -> list[dict]:
    try:
        url = f"{DEVICE_SERVICE_URL}/devices/internal"
        r = client.get(url, timeout=5.0)
        if r.status_code == 200:
            return r.json()
        logger.warning("Could not fetch active devices (status %d): %s", r.status_code, r.text)
    except Exception as e:
        logger.warning("Error fetching active devices from %s: %s", DEVICE_SERVICE_URL, e)
    return []


def main():
    logger.info("Starting Smart Meter Sensor Simulator...")
    logger.info(
        "Interval: %ss | Spikes Enabled: %s (every %d ticks)",
        SIMULATION_INTERVAL,
        ENABLE_SPIKES,
        SPIKE_EVERY,
    )

    connection = connect_rabbitmq(RABBITMQ_URL)
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type="topic", durable=True)

    simulator = SensorLoadSimulator(enable_spikes=ENABLE_SPIKES, spike_every=SPIKE_EVERY)
    http_client = httpx.Client()

    device_refresh_interval = 15.0
    last_device_refresh = 0.0
    active_devices = []

    try:
        while running:
            now_mono = time.monotonic()
            if now_mono - last_device_refresh > device_refresh_interval or not active_devices:
                active_devices = fetch_active_devices(http_client)
                last_device_refresh = now_mono
                if active_devices:
                    logger.info(
                        "Discovered %d active metering device(s) to simulate.",
                        len(active_devices),
                    )
                else:
                    logger.info("No active devices found. Waiting for devices to be created...")

            if active_devices:
                for dev in active_devices:
                    device_id = str(dev["id"])
                    device_name = dev.get("name", "Unknown Device")
                    reading = simulator.get_reading(device_id)

                    payload = {
                        "timestamp": datetime.now(UTC).isoformat(),
                        "device_id": device_id,
                        "measurement_value": reading,
                    }

                    try:
                        channel.basic_publish(
                            exchange=EXCHANGE_NAME,
                            routing_key=ROUTING_KEY,
                            body=json.dumps(payload),
                            properties=pika.BasicProperties(
                                delivery_mode=pika.DeliveryMode.Persistent,
                                content_type="application/json",
                            ),
                        )
                        logger.info(
                            "Published reading for '%s' (%s): %.3f kWh",
                            device_name,
                            device_id,
                            reading,
                        )
                    except (
                        pika.exceptions.AMQPConnectionError,
                        pika.exceptions.AMQPChannelError,
                    ) as publish_err:
                        logger.warning(
                            "Publish failed: %s. Reconnecting to RabbitMQ...",
                            publish_err,
                        )
                        connection = connect_rabbitmq(RABBITMQ_URL)
                        channel = connection.channel()
                        channel.exchange_declare(
                            exchange=EXCHANGE_NAME,
                            exchange_type="topic",
                            durable=True,
                        )
                        break

            time.sleep(SIMULATION_INTERVAL)

    finally:
        http_client.close()
        try:
            if connection and not connection.is_closed:
                connection.close()
        except Exception:
            pass
        logger.info("Sensor simulator stopped.")


if __name__ == "__main__":
    main()
