import logging
import uuid

from fastapi import WebSocket

from backend.services.monitoring.schemas import AlertNotification

logger = logging.getLogger("monitoring-service.websocket")


class WebSocketConnectionManager:
    def __init__(self):
        self.user_connections: dict[uuid.UUID, list[WebSocket]] = {}
        self.admin_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID, is_admin: bool = False):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

        if is_admin:
            self.admin_connections.append(websocket)

        logger.info(
            "WebSocket connected: user_id=%s (is_admin=%s). Total user clients: %d",
            user_id,
            is_admin,
            len(self.user_connections[user_id]),
        )

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID):
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

        logger.info("WebSocket disconnected: user_id=%s", user_id)

    async def dispatch_alert(self, alert: AlertNotification):
        payload = alert.model_dump(mode="json")
        recipients = []

        if alert.user_id and alert.user_id in self.user_connections:
            recipients.extend(self.user_connections[alert.user_id])

        # Also notify active admins
        for admin_ws in self.admin_connections:
            if admin_ws not in recipients:
                recipients.append(admin_ws)

        dead_sockets = []
        for ws in recipients:
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.warning("Error sending WebSocket frame: %s", e)
                dead_sockets.append(ws)

        for ws in dead_sockets:
            if (
                alert.user_id
                and alert.user_id in self.user_connections
                and ws in self.user_connections[alert.user_id]
            ):
                self.user_connections[alert.user_id].remove(ws)
            if ws in self.admin_connections:
                self.admin_connections.remove(ws)


ws_manager = WebSocketConnectionManager()
