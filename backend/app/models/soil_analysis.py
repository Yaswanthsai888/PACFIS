from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class SoilAnalysis(Base):
    __tablename__ = "soil_analyses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id = Column(String, ForeignKey("fields.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Store the crop name we used when generating the analysis
    crop_name = Column(String, nullable=True)

    health_score = Column(Integer, nullable=True)
    health_label = Column(String, nullable=True)

    # Raw/preserved AI payload so frontend can display without recomputation
    analysis = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

