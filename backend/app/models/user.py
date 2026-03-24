from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # Profile / settings fields (Phase 3+)
    farm_name = Column(String, nullable=True)
    location_city = Column(String, nullable=True)
    location_state = Column(String, nullable=True)
    language = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())