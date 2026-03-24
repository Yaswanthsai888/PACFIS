from pydantic import BaseModel
from typing import Optional


class NotificationResponse(BaseModel):
    id: str
    user_id: int
    type: str
    title: str
    message: str
    read: bool
    created_at: str

    class Config:
        from_attributes = True

