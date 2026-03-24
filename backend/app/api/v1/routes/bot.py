from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import asyncio

from app.core.database import get_db
from app.core.auth_deps import get_current_user
from app.models.bot_task import BotTask
from app.models.field import Field
from app.models.user import User
from app.schemas.bot import BotTaskCreate, BotTaskResponse, BotTaskUpdateStatus


router = APIRouter()
ws_router = APIRouter()


@router.get("/test")
def bot_test():
    return {"route": "bot working"}


def task_to_response(t: BotTask) -> BotTaskResponse:
    return BotTaskResponse(
        id=str(t.id),
        field_id=str(t.field_id),
        user_id=int(t.user_id),
        task_name=str(t.task_name),
        description=str(t.description) if t.description else None,
        priority=str(t.priority),
        estimated_minutes=int(t.estimated_minutes) if t.estimated_minutes is not None else None,
        status=str(t.status),
        created_at=str(t.created_at),
    )


@router.post("/tasks", response_model=BotTaskResponse)
async def create_task(
    data: BotTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure field belongs to current user
    field_q = await db.execute(select(Field).where(Field.id == data.field_id, Field.user_id == current_user.id))
    field = field_q.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    task = BotTask(
        field_id=str(data.field_id),
        user_id=int(current_user.id),
        task_name=str(data.task_name),
        description=data.description,
        priority=str(data.priority) if data.priority else "normal",
        estimated_minutes=data.estimated_minutes,
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task_to_response(task)


@router.get("/tasks", response_model=list[BotTaskResponse])
async def list_tasks(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(BotTask).where(BotTask.user_id == current_user.id)
    if status:
        q = q.where(BotTask.status == status)
    q = q.order_by(BotTask.created_at.desc())
    result = await db.execute(q)
    tasks = result.scalars().all()
    return [task_to_response(t) for t in tasks]


@router.put("/tasks/{task_id}", response_model=BotTaskResponse)
async def update_task_status(
    task_id: str,
    data: BotTaskUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BotTask).where(BotTask.id == task_id, BotTask.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    allowed = {"pending", "in_progress", "done"}
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {sorted(allowed)}")

    task.status = data.status
    await db.commit()
    await db.refresh(task)
    return task_to_response(task)


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BotTask).where(BotTask.id == task_id, BotTask.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return {"message": "Task deleted"}


@ws_router.websocket("/ws/bot")
async def bot_ws(websocket: WebSocket):
    """
    Phase-3 placeholder websocket.
    The frontend currently just needs the connection to exist and remain offline-friendly.
    """
    await websocket.accept()
    payload = {
        "task": "Awaiting connection",
        "battery": 0,
        "speed": 0,
        "position": {"x": 0, "z": 0},
        "completedRows": [],
        "rowStatuses": {},
        "timeOfDay": 8,
        "isMoving": False,
    }
    await websocket.send_json(payload)

    # Wait until the client disconnects.
    try:
        while True:
            # Keep the connection alive; we don't expect client->server messages yet.
            await websocket.receive_text()
            await asyncio.sleep(0)
    except WebSocketDisconnect:
        return