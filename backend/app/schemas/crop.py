from pydantic import BaseModel
from typing import Optional

class CropAssignmentCreate(BaseModel):
    field_id: str
    crop_name: str
    crop_variety: Optional[str] = None
    planting_date: Optional[str] = None
    expected_harvest_date: Optional[str] = None
    growth_duration_days: Optional[int] = None
    water_requirement: Optional[str] = None
    expected_yield_per_ha: Optional[float] = None
    soil_ph_min: Optional[float] = None
    soil_ph_max: Optional[float] = None
    nitrogen_requirement: Optional[str] = None
    season: Optional[str] = None
    notes: Optional[str] = None

class CropAssignmentResponse(BaseModel):
    id: str
    field_id: str
    crop_name: str
    crop_variety: Optional[str]
    planting_date: Optional[str]
    expected_harvest_date: Optional[str]
    growth_duration_days: Optional[int]
    water_requirement: Optional[str]
    expected_yield_per_ha: Optional[float]
    soil_ph_min: Optional[float]
    soil_ph_max: Optional[float]
    nitrogen_requirement: Optional[str]
    season: Optional[str]
    notes: Optional[str]
    status: str
    created_at: str

    class Config:
        from_attributes = True