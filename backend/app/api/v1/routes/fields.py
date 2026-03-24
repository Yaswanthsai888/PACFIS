from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth_deps import get_current_user
from app.models.field import Field
from app.models.user import User
from app.models.notification import Notification
from app.schemas.field import FieldCreate, FieldUpdate, FieldResponse
from typing import List
import uuid

router = APIRouter()

def field_to_response(f: Field) -> FieldResponse:
    return FieldResponse(
        id=str(f.id),
        name=str(f.name),
        coordinates=f.coordinates if f.coordinates else [],
        area_sqm=float(f.area_sqm) if f.area_sqm else None,
        status=str(f.status),
        created_at=str(f.created_at)
    )

@router.get("/", response_model=List[FieldResponse])
async def get_fields(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Field).where(Field.user_id == current_user.id)
    )
    fields = result.scalars().all()
    return [field_to_response(f) for f in fields]

@router.post("/", response_model=FieldResponse)
async def create_field(
    data: FieldCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    field = Field(
        id=str(uuid.uuid4()),
        user_id=int(current_user.id),
        name=data.name,
        coordinates=[c.model_dump() for c in data.coordinates],
        area_sqm=data.area_sqm,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)

    # Auto-notification: new field created
    try:
        db.add(
            Notification(
                user_id=int(current_user.id),
                type="info",
                title="New field created",
                message=f"{field.name} has been added to your farm.",
            )
        )
        await db.commit()
    except Exception:
        # Best-effort: don't fail the core operation.
        await db.rollback()

    return field_to_response(field)

@router.put("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: str,
    data: FieldUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Field).where(Field.id == field_id, Field.user_id == current_user.id)
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    if data.name is not None:
        field.name = data.name
    if data.coordinates is not None:
        field.coordinates = [c.model_dump() for c in data.coordinates]
    if data.area_sqm is not None:
        field.area_sqm = data.area_sqm

    await db.commit()
    await db.refresh(field)
    return field_to_response(field)

@router.delete("/{field_id}")
async def delete_field(
    field_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Field).where(Field.id == field_id, Field.user_id == current_user.id)
    )
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    await db.delete(field)
    await db.commit()
    return {"message": "Field deleted"}