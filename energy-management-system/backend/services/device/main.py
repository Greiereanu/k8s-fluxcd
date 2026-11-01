import logging
import uuid
from contextlib import asynccontextmanager

from backend.common.auth import require_admin, require_authenticated
from backend.common.models import CurrentUser, MessageResponse, UserRole
from backend.services.device.database import Base, engine, get_db
from backend.services.device.models import Device
from backend.services.device.schemas import (
    DeviceAssignRequest,
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
)
from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("device-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Device service database tables initialized.")
    yield
    await engine.dispose()


app = FastAPI(
    title="Energy Management - Device Management Service",
    description="Microservice responsible for smart metering device CRUD and user mapping",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "device-service"}


@app.get("/devices", response_model=list[DeviceResponse], tags=["Devices"])
async def list_all_devices(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(require_admin)
):
    """Admin only: list all registered metering devices."""
    result = await db.execute(select(Device).order_by(Device.created_at.desc()))
    return result.scalars().all()


@app.post(
    "/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED, tags=["Devices"]
)
async def create_device(
    req: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: register a new smart energy metering device."""
    new_device = Device(
        id=uuid.uuid4(),
        name=req.name,
        description=req.description,
        address=req.address,
        max_consumption=req.max_consumption,
        assigned_user_id=req.assigned_user_id,
        status=req.status,
    )
    db.add(new_device)
    await db.commit()
    await db.refresh(new_device)
    return new_device


@app.get("/devices/my-devices", response_model=list[DeviceResponse], tags=["Devices"])
async def get_my_devices(
    db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(require_authenticated)
):
    """Client role: view all energy devices assigned to the authenticated user's account."""
    stmt = (
        select(Device).where(Device.assigned_user_id == current_user.user_id).order_by(Device.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/devices/{device_id}", response_model=DeviceResponse, tags=["Devices"])
async def get_device_by_id(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_authenticated),
):
    """Admin or device owner: view device specifications."""
    stmt = select(Device).where(Device.id == device_id)
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Device with ID '{device_id}' not found"
        )

    # Check permission: Admin can see any, Client can only see their own device
    if current_user.role != UserRole.ADMIN and device.assigned_user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this device is not permitted for your account",
        )

    return device


@app.put("/devices/{device_id}", response_model=DeviceResponse, tags=["Devices"])
async def update_device(
    device_id: uuid.UUID,
    req: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: update metering device metadata or maximum consumption."""
    stmt = select(Device).where(Device.id == device_id)
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Device with ID '{device_id}' not found"
        )

    if req.name is not None:
        device.name = req.name
    if req.description is not None:
        device.description = req.description
    if req.address is not None:
        device.address = req.address
    if req.max_consumption is not None:
        device.max_consumption = req.max_consumption
    if req.assigned_user_id is not None:
        device.assigned_user_id = req.assigned_user_id
    if req.status is not None:
        device.status = req.status

    await db.commit()
    await db.refresh(device)
    return device


@app.delete("/devices/{device_id}", response_model=MessageResponse, tags=["Devices"])
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: delete a metering device."""
    stmt = select(Device).where(Device.id == device_id)
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Device with ID '{device_id}' not found"
        )

    await db.delete(device)
    await db.commit()
    return MessageResponse(message=f"Device '{device.name}' ({device_id}) deleted successfully")


@app.post("/devices/{device_id}/assign", response_model=DeviceResponse, tags=["Devices"])
async def assign_device(
    device_id: uuid.UUID,
    req: DeviceAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: assign a metering device to a specific client user."""
    stmt = select(Device).where(Device.id == device_id)
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Device with ID '{device_id}' not found"
        )

    device.assigned_user_id = req.user_id
    await db.commit()
    await db.refresh(device)
    return device


@app.post("/devices/{device_id}/unassign", response_model=DeviceResponse, tags=["Devices"])
async def unassign_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Admin only: remove user mapping from a device."""
    stmt = select(Device).where(Device.id == device_id)
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Device with ID '{device_id}' not found"
        )

    device.assigned_user_id = None
    await db.commit()
    await db.refresh(device)
    return device


@app.post("/devices/unassign-user/{user_id}", response_model=MessageResponse, tags=["Internal"])
async def unassign_all_for_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Internal: unassign all devices previously assigned to a deleted user."""
    stmt = update(Device).where(Device.assigned_user_id == user_id).values(assigned_user_id=None)
    result = await db.execute(stmt)
    await db.commit()
    return MessageResponse(message=f"Unassigned {result.rowcount} devices for user '{user_id}'")
