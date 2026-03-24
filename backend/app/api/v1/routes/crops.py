from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth_deps import get_current_user
from app.models.crop import CropAssignment
from app.models.user import User
from app.models.notification import Notification
from app.schemas.crop import CropAssignmentCreate, CropAssignmentResponse
from typing import List
import uuid

router = APIRouter()

def crop_to_response(c: CropAssignment) -> CropAssignmentResponse:
    return CropAssignmentResponse(
        id=str(c.id),
        field_id=str(c.field_id),
        crop_name=str(c.crop_name),
        crop_variety=str(c.crop_variety) if c.crop_variety else None,
        planting_date=str(c.planting_date) if c.planting_date else None,
        expected_harvest_date=str(c.expected_harvest_date) if c.expected_harvest_date else None,
        growth_duration_days=int(c.growth_duration_days) if c.growth_duration_days else None,
        water_requirement=str(c.water_requirement) if c.water_requirement else None,
        expected_yield_per_ha=float(c.expected_yield_per_ha) if c.expected_yield_per_ha else None,
        soil_ph_min=float(c.soil_ph_min) if c.soil_ph_min else None,
        soil_ph_max=float(c.soil_ph_max) if c.soil_ph_max else None,
        nitrogen_requirement=str(c.nitrogen_requirement) if c.nitrogen_requirement else None,
        season=str(c.season) if c.season else None,
        notes=str(c.notes) if c.notes else None,
        status=str(c.status),
        created_at=str(c.created_at),
    )

@router.get("/", response_model=List[CropAssignmentResponse])
async def get_crops(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CropAssignment).where(CropAssignment.user_id == current_user.id)
    )
    return [crop_to_response(c) for c in result.scalars().all()]

@router.get("/field/{field_id}", response_model=CropAssignmentResponse)
async def get_crop_for_field(
    field_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CropAssignment).where(
            CropAssignment.field_id == field_id,
            CropAssignment.user_id == current_user.id
        )
    )
    crop = result.scalar_one_or_none()
    if not crop:
        raise HTTPException(status_code=404, detail="No crop assigned to this field")
    return crop_to_response(crop)

@router.post("/", response_model=CropAssignmentResponse)
async def assign_crop(
    data: CropAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Remove existing crop for this field
    existing = await db.execute(
        select(CropAssignment).where(
            CropAssignment.field_id == data.field_id,
            CropAssignment.user_id == current_user.id
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)

    crop = CropAssignment(
        id=str(uuid.uuid4()),
        user_id=int(current_user.id),
        **data.model_dump()
    )
    db.add(crop)
    await db.commit()
    await db.refresh(crop)

    # Auto-notification: crop assigned
    try:
        db.add(
            Notification(
                user_id=int(current_user.id),
                type="success",
                title="Crop assigned",
                message=f"{crop.crop_name} has been assigned to {field_id}.",
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()

    return crop_to_response(crop)

@router.delete("/{crop_id}")
async def delete_crop(
    crop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CropAssignment).where(
            CropAssignment.id == crop_id,
            CropAssignment.user_id == current_user.id
        )
    )
    crop = result.scalar_one_or_none()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    await db.delete(crop)
    await db.commit()
    return {"message": "Crop removed"}