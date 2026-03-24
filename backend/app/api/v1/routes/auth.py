from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.auth_deps import get_current_user
from app.models.user import User
from app.models.field import Field
from app.models.crop import CropAssignment
from app.models.bot_task import BotTask
from app.models.yield_prediction import YieldPrediction
from app.models.notification import Notification
from app.models.soil_analysis import SoilAnalysis
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
    ProfileUpdateRequest,
    ChangePasswordRequest,
    ProfileResponse,
)

router = APIRouter()

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )

@router.post("/forgot-password")
async def forgot_password(data: dict, db: AsyncSession = Depends(get_db)):
    # Email sending will be added later
    return {"message": "If that email exists, a reset link has been sent"}


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.first_name is not None:
        current_user.first_name = data.first_name
    if data.last_name is not None:
        current_user.last_name = data.last_name
    if data.farm_name is not None:
        current_user.farm_name = data.farm_name
    if data.location_city is not None:
        current_user.location_city = data.location_city
    if data.location_state is not None:
        current_user.location_state = data.location_state
    if data.language is not None:
        current_user.language = data.language

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # `current_user` is already loaded via `get_current_user`.
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password updated"}


@router.delete("/account")
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = int(current_user.id)

    # Delete dependent rows first (dev SQLite; keep explicit deletes for correctness).
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.execute(delete(YieldPrediction).where(YieldPrediction.user_id == user_id))
    await db.execute(delete(SoilAnalysis).where(SoilAnalysis.user_id == user_id))
    await db.execute(delete(BotTask).where(BotTask.user_id == user_id))
    await db.execute(delete(CropAssignment).where(CropAssignment.user_id == user_id))
    await db.execute(delete(Field).where(Field.user_id == user_id))

    await db.delete(current_user)
    await db.commit()

    return {"message": "Account deleted"}