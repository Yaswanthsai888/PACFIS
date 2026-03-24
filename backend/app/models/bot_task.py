from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class BotTask(Base):
    __tablename__ = "bot_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id = Column(String, ForeignKey("fields.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    task_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    # Use "urgent" | "normal" | "low" (per frontend badges)
    priority = Column(String, nullable=False, default="normal")
    estimated_minutes = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="pending")

    # Optional raw metadata so we can evolve tasks without migrations
    meta = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

