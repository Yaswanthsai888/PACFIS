from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.core.database import get_db
from app.core.auth_deps import get_current_user
from app.models.yield_prediction import YieldPrediction
from app.models.user import User
from app.schemas.yield_prediction import YieldPredictionResponse


router = APIRouter()


def pred_to_response(p: YieldPrediction) -> YieldPredictionResponse:
    return YieldPredictionResponse(
        id=str(p.id),
        field_id=str(p.field_id),
        user_id=int(p.user_id),
        crop_name=str(p.crop_name),
        predicted_yield=float(p.predicted_yield),
        yield_per_ha=float(p.yield_per_ha) if p.yield_per_ha is not None else None,
        confidence=str(p.confidence) if p.confidence is not None else None,
        vs_standard=str(p.vs_standard) if p.vs_standard is not None else None,
        factors=p.factors,
        tips=p.tips,
        created_at=str(p.created_at),
    )


@router.get("/history", response_model=List[YieldPredictionResponse])
async def yield_history(
    field_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(YieldPrediction).where(YieldPrediction.user_id == current_user.id)
    if field_id:
        q = q.where(YieldPrediction.field_id == field_id)
    q = q.order_by(YieldPrediction.created_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    return [pred_to_response(r) for r in rows]


@router.get("/field/{field_id}", response_model=List[YieldPredictionResponse])
async def yield_history_for_field(
    field_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(YieldPrediction)
        .where(YieldPrediction.user_id == current_user.id)
        .where(YieldPrediction.field_id == field_id)
        .order_by(YieldPrediction.created_at.desc())
    )
    result = await db.execute(q)
    rows = result.scalars().all()
    return [pred_to_response(r) for r in rows]

