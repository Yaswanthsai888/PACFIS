from fastapi import APIRouter
from .routes import auth, bot, crops, fields, ai, yield_routes, notifications

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(bot.router, prefix="/bot", tags=["bot"])
router.include_router(crops.router, prefix="/crops", tags=["crops"])
router.include_router(fields.router, prefix="/fields", tags=["fields"])
router.include_router(ai.router, prefix="/ai", tags=["ai"])
router.include_router(yield_routes.router, prefix="/yield", tags=["yield"])
router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])