from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class YieldPrediction(Base):
    __tablename__ = "yield_predictions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id = Column(String, ForeignKey("fields.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    crop_name = Column(String, nullable=False)
    predicted_yield = Column(Float, nullable=False)  # total tonnes
    yield_per_ha = Column(Float, nullable=True)
    confidence = Column(String, nullable=True)
    vs_standard = Column(String, nullable=True)

    factors = Column(JSON, nullable=True)
    tips = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

