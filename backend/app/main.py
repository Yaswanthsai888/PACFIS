import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import router
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Pac-Bot API", version="1.0.0", lifespan=lifespan)

# Allow all Vercel domains and localhost for development
import re

def is_allowed_origin(origin: str) -> bool:
    if not origin:
        return False
    
    # Allow localhost
    if origin.startswith("http://localhost:"):
        return True
    
    # Allow all Vercel domains
    if origin.endswith(".vercel.app"):
        return True
    
    # Allow specific domains from environment
    allowed_env = os.getenv("FRONTEND_URL", "")
    if allowed_env and origin == allowed_env:
        return True
    
    return False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins, we'll validate in middleware
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "online", "service": "pacbot-api"}
