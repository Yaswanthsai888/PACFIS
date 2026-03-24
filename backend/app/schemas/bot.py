from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BotTaskCreate(BaseModel):
    field_id: str
    task_name: str
    description: Optional[str] = None
    priority: Optional[str] = "normal"
    estimated_minutes: Optional[int] = None


class BotTaskUpdateStatus(BaseModel):
    status: str


class BotTaskResponse(BaseModel):
    id: str
    field_id: str
    user_id: int
    task_name: str
    description: Optional[str]
    priority: str
    estimated_minutes: Optional[int]
    status: str
    created_at: str

    class Config:
        from_attributes = True

