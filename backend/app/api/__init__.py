from fastapi import APIRouter
from app.api.v1.routes import auth, fields, crops, bot,ai

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(fields.router, prefix="/fields", tags=["fields"])
router.include_router(crops.router, prefix="/crops", tags=["crops"])
router.include_router(bot.router, prefix="/bot", tags=["bot"])
router.include_router(ai.router, prefix="/ai", tags=["ai"])