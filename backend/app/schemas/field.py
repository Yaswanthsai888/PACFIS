from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class Coordinate(BaseModel):
    lat: float
    lng: float

class FieldCreate(BaseModel):
    name: str
    coordinates: List[Coordinate]
    area_sqm: Optional[float] = None

class FieldUpdate(BaseModel):
    name: Optional[str] = None
    coordinates: Optional[List[Coordinate]] = None
    area_sqm: Optional[float] = None

class FieldResponse(BaseModel):
    id: str
    name: str
    coordinates: List[dict]
    area_sqm: Optional[float]
    status: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)