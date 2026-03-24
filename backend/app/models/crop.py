from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class CropAssignment(Base):
    __tablename__ = "crop_assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id = Column(String, ForeignKey("fields.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    crop_name = Column(String, nullable=False)
    crop_variety = Column(String, nullable=True)
    planting_date = Column(String, nullable=True)
    expected_harvest_date = Column(String, nullable=True)
    growth_duration_days = Column(Integer, nullable=True)
    water_requirement = Column(String, nullable=True)
    expected_yield_per_ha = Column(Float, nullable=True)
    soil_ph_min = Column(Float, nullable=True)
    soil_ph_max = Column(Float, nullable=True)
    nitrogen_requirement = Column(String, nullable=True)
    season = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="planned")
    created_at = Column(DateTime(timezone=True), server_default=func.now())