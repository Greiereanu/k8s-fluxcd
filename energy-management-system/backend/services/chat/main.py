import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.common.auth import require_admin, require_authenticated
from backend.common.models import CurrentUser, MessageResponse, UserRole
from backend.common.security import decode_access_token
from backend.services.chat.database import AsyncSessionLocal, Base, engine, get_db
from backend.services.chat.models import ChatMessage, ChatSession
from backend.services.chat.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionDetail,
    ChatSessionSummary,
)
from backend.services.chat.websocket import chat_ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chat-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Chat service database tables initialized.")
    yield
    await engine.dispose()
    logger.info("Chat service shutdown complete.")


app = FastAPI(
    title="Energy Management - Customer Support & Chat Service",
    description="Microservice providing real-time support chat between clients and administrators",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "chat-service"}


@app.get("/chat/sessions", response_model=list[ChatSessionSummary], tags=["Chat"])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: list all client support chat sessions with unread counts and latest messages."""
    stmt = (
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .order_by(ChatSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    summaries = []
    for s in sessions:
        msgs = s.messages
        last_msg = msgs[-1] if msgs else None
        unread_count = sum(1 for m in msgs if not m.is_read and m.sender_role == UserRole.CLIENT)

        summaries.append(
            ChatSessionSummary(
                id=s.id,
                client_user_id=s.client_user_id,
                client_username=s.client_username,
                is_active=s.is_active,
                created_at=s.created_at,
                updated_at=s.updated_at,
                last_message=ChatMessageResponse.model_validate(last_msg) if last_msg else None,
                unread_count=unread_count,
            )
        )

    return summaries


@app.get("/chat/sessions/me", response_model=ChatSessionDetail, tags=["Chat"])
async def get_or_create_my_session(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Client role: get or automatically create active support chat session with message history."""
    stmt = (
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.client_user_id == current_user.user_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        session = ChatSession(
            id=uuid.uuid4(),
            client_user_id=current_user.user_id,
            client_username=current_user.username,
            is_active=True,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return ChatSessionDetail(
            id=session.id,
            client_user_id=session.client_user_id,
            client_username=session.client_username,
            is_active=session.is_active,
            messages=[],
        )

    return ChatSessionDetail(
        id=session.id,
        client_user_id=session.client_user_id,
        client_username=session.client_username,
        is_active=session.is_active,
        messages=[ChatMessageResponse.model_validate(m) for m in session.messages],
    )


@app.get(
    "/chat/sessions/{session_id}/messages",
    response_model=list[ChatMessageResponse],
    tags=["Chat"],
)
async def get_session_messages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Retrieve all messages for a specific chat session."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found"
        )

    if current_user.role != UserRole.ADMIN and session.client_user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this conversation is not permitted",
        )

    msg_stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.asc())
    )
    msg_res = await db.execute(msg_stmt)
    messages = msg_res.scalars().all()
    return [ChatMessageResponse.model_validate(m) for m in messages]


@app.post(
    "/chat/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Chat"],
)
async def send_session_message(
    session_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Send a message to a chat session via REST."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found"
        )

    if current_user.role != UserRole.ADMIN and session.client_user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this conversation is not permitted",
        )

    content = payload.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message content cannot be empty",
        )

    new_message = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_id=current_user.user_id,
        sender_username=current_user.username,
        sender_role=current_user.role.value,
        content=content,
        is_read=False,
        timestamp=datetime.now(UTC),
    )
    db.add(new_message)
    session.updated_at = func.now()
    await db.commit()
    await db.refresh(new_message)

    msg_event = {
        "type": "MESSAGE_RECEIVED",
        "message_id": str(new_message.id),
        "session_id": str(session.id),
        "client_user_id": str(session.client_user_id),
        "client_username": session.client_username,
        "sender_id": str(current_user.user_id),
        "sender_username": current_user.username,
        "sender_role": current_user.role.value,
        "content": new_message.content,
        "timestamp": new_message.timestamp.isoformat(),
        "is_read": False,
    }
    await chat_ws_manager.send_to_client(session.client_user_id, msg_event)
    await chat_ws_manager.broadcast_to_admins(msg_event)

    return ChatMessageResponse.model_validate(new_message)


@app.post("/chat/sessions/{session_id}/read", response_model=MessageResponse, tags=["Chat"])
async def mark_session_read(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Mark incoming messages in a conversation as read."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found"
        )

    # If admin marks as read, mark CLIENT messages. If client marks as read, mark ADMIN messages.
    target_role = UserRole.CLIENT if current_user.role == UserRole.ADMIN else UserRole.ADMIN

    upd_stmt = (
        update(ChatMessage)
        .where(
            ChatMessage.session_id == session_id,
            ChatMessage.sender_role == target_role,
            ChatMessage.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.execute(upd_stmt)
    await db.commit()

    receipt_event = {
        "type": "READ_RECEIPT",
        "session_id": str(session_id),
        "read_by_role": current_user.role.value,
    }
    await chat_ws_manager.send_to_client(session.client_user_id, receipt_event)
    await chat_ws_manager.broadcast_to_admins(receipt_event)

    return MessageResponse(message="Conversation messages marked as read")


@app.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket, token: str | None = None):
    """Real-time bidirectional WebSocket channel for client-admin chat."""
    token_str = token or websocket.query_params.get("token")
    if not token_str:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    payload = decode_access_token(token_str)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    user_id = payload.user_id
    username = payload.username
    is_admin = payload.role == UserRole.ADMIN

    await chat_ws_manager.connect(websocket, user_id=user_id, is_admin=is_admin)

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type", "MESSAGE")

            if msg_type == "MESSAGE":
                content = (data.get("content") or "").strip()
                if not content:
                    continue

                session_id_str = data.get("session_id")

                async with AsyncSessionLocal() as session_db:
                    # Resolve or create session
                    if session_id_str:
                        target_session_id = uuid.UUID(session_id_str)
                        s_stmt = select(ChatSession).where(ChatSession.id == target_session_id)
                        res = await session_db.execute(s_stmt)
                        chat_session = res.scalar_one_or_none()
                    else:
                        s_stmt = select(ChatSession).where(ChatSession.client_user_id == user_id)
                        res = await session_db.execute(s_stmt)
                        chat_session = res.scalar_one_or_none()

                    if not chat_session:
                        chat_session = ChatSession(
                            id=uuid.uuid4(),
                            client_user_id=user_id,
                            client_username=username,
                            is_active=True,
                        )
                        session_db.add(chat_session)
                        await session_db.flush()

                    new_message = ChatMessage(
                        id=uuid.uuid4(),
                        session_id=chat_session.id,
                        sender_id=user_id,
                        sender_username=username,
                        sender_role=payload.role.value,
                        content=content,
                        is_read=False,
                        timestamp=datetime.now(UTC),
                    )
                    session_db.add(new_message)
                    chat_session.updated_at = func.now()
                    await session_db.commit()

                    msg_event = {
                        "type": "MESSAGE_RECEIVED",
                        "message_id": str(new_message.id),
                        "session_id": str(chat_session.id),
                        "client_user_id": str(chat_session.client_user_id),
                        "client_username": chat_session.client_username,
                        "sender_id": str(user_id),
                        "sender_username": username,
                        "sender_role": payload.role.value,
                        "content": content,
                        "timestamp": new_message.timestamp.isoformat(),
                        "is_read": False,
                    }

                    # Deliver to client and broadcast to all admins
                    await chat_ws_manager.send_to_client(chat_session.client_user_id, msg_event)
                    await chat_ws_manager.broadcast_to_admins(msg_event)

            elif msg_type == "TYPING":
                session_id_str = data.get("session_id")
                is_typing = bool(data.get("is_typing", True))
                typing_event = {
                    "type": "TYPING",
                    "session_id": session_id_str,
                    "sender_role": payload.role.value,
                    "sender_username": username,
                    "is_typing": is_typing,
                }
                client_user_id_str = data.get("client_user_id")
                if client_user_id_str:
                    await chat_ws_manager.send_to_client(
                        uuid.UUID(client_user_id_str), typing_event
                    )
                await chat_ws_manager.broadcast_to_admins(typing_event)

    except WebSocketDisconnect:
        chat_ws_manager.disconnect(websocket, user_id=user_id, is_admin=is_admin)
    except Exception as e:
        logger.warning("Chat WebSocket connection error: %s", e)
        chat_ws_manager.disconnect(websocket, user_id=user_id, is_admin=is_admin)
