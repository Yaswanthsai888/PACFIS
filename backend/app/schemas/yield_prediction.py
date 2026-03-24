from pydantic import BaseModel
from typing import Any, Optional


class YieldPredictionResponse(BaseModel):
    id: str
    field_id: str
    user_id: int
    crop_name: str
    predicted_yield: float
    yield_per_ha: Optional[float]
    confidence: Optional[str]
    vs_standard: Optional[str]
    factors: Optional[Any]
    tips: Optional[Any]
    created_at: str

    class Config:
        from_attributes = True

