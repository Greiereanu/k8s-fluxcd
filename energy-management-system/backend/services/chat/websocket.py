import logging
import uuid

from fastapi import WebSocket

logger = logging.getLogger("chat-service.websocket")


class ChatWebSocketManager:
    def __init__(self):
        self.client_connections: dict[uuid.UUID, list[WebSocket]] = {}
        self.admin_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID, is_admin: bool = False):
        await websocket.accept()
        if is_admin:
            self.admin_connections.append(websocket)
        else:
            if user_id not in self.client_connections:
                self.client_connections[user_id] = []
            self.client_connections[user_id].append(websocket)

        logger.info(
            "Chat WebSocket connected: user_id=%s (is_admin=%s). Active clients=%d, admins=%d",
            user_id,
            is_admin,
            len(self.client_connections),
            len(self.admin_connections),
        )

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID, is_admin: bool = False):
        if is_admin:
            if websocket in self.admin_connections:
                self.admin_connections.remove(websocket)
        else:
            if user_id in self.client_connections:
                if websocket in self.client_connections[user_id]:
                    self.client_connections[user_id].remove(websocket)
                if not self.client_connections[user_id]:
                    del self.client_connections[user_id]

        logger.info("Chat WebSocket disconnected: user_id=%s (is_admin=%s)", user_id, is_admin)

    async def send_to_client(self, client_user_id: uuid.UUID, payload: dict):
        if client_user_id in self.client_connections:
            dead_sockets = []
            for ws in self.client_connections[client_user_id]:
                try:
                    await ws.send_json(payload)
                except Exception as e:
                    logger.warning("Error sending message to client %s: %s", client_user_id, e)
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                if ws in self.client_connections[client_user_id]:
                    self.client_connections[client_user_id].remove(ws)

    async def broadcast_to_admins(self, payload: dict):
        dead_sockets = []
        for ws in self.admin_connections:
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.warning("Error broadcasting message to admin: %s", e)
                dead_sockets.append(ws)
        for ws in dead_sockets:
            if ws in self.admin_connections:
                self.admin_connections.remove(ws)


chat_ws_manager = ChatWebSocketManager()
