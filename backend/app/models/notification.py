from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)

    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

