from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List

from app.core.database import get_db
from app.core.auth_deps import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse


router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.read.asc(), Notification.created_at.desc())
    )
    result = await db.execute(q)
    rows = result.scalars().all()
    return rows


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.read = True
    await db.commit()
    await db.refresh(n)
    return n


@router.delete("/clear")
async def clear_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = delete(Notification).where(Notification.user_id == current_user.id)
    result = await db.execute(q)
    await db.commit()
    # rowcount may be unsupported on some backends; best-effort.
    count = getattr(result, "rowcount", None)
    return {"message": "Notifications cleared", "deleted": count}

