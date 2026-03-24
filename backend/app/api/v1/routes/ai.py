from fastapi import APIRouter, Depends, HTTPException
from app.core.auth_deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.field import Field
from app.models.crop import CropAssignment
from app.models.yield_prediction import YieldPrediction
from app.models.soil_analysis import SoilAnalysis
from app.models.notification import Notification
import httpx
import os
import json
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

PACFIS_SYSTEM_PROMPT = """You are PAC-FIS, an agricultural intelligence system built specifically for Indian farmers.
You have expert knowledge of:
- Soil health analysis, pH levels, NPK requirements for Indian soils
- Indian crop varieties: rice, wheat, cotton, sugarcane, vegetables, pulses
- Pest and disease identification common in Telangana and Andhra Pradesh
- Water management, drip irrigation, and monsoon farming
- Seasonal Kharif/Rabi/Summer crop cycles
- Organic and sustainable farming practices for small-to-medium farms
- Market prices and yield expectations for Indian agricultural markets

You always:
- Give practical, specific, actionable advice a farmer can act on today
- Consider the specific location (Telangana, India) and season
- Provide advice appropriate for a bot-assisted autonomous farm
- Respond ONLY in the JSON format specified in each request
- Never give generic advice — always specific to the field data provided
"""


@router.get("/status")
async def ai_status():
    return {"configured": bool(ANTHROPIC_API_KEY)}

def extract_json(text: str):
    """
    AI providers sometimes wrap JSON in extra text; attempt to recover the first JSON object.
    """
    if not text:
        return None

    # Fast path: already pure JSON.
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strip common markdown fences.
    cleaned = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text.strip())

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Fallback: first {...} block.
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None

@router.post("/analyze-soil")
async def analyze_soil(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1000,
                "system": PACFIS_SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": payload.get("prompt", "")}]
            }
        )
        data = response.json()
        text = data.get("content", [{}])[0].get("text", "{}")

        # Optional persistence + notification: frontend can send `field_id` + `crop_name`.
        try:
            field_id = payload.get("field_id")
            crop_name = payload.get("crop_name") or payload.get("crop")
            parsed = extract_json(text)

            if field_id and crop_name and isinstance(parsed, dict):
                f_q = await db.execute(select(Field).where(Field.id == field_id, Field.user_id == current_user.id))
                field = f_q.scalar_one_or_none()
                if field:
                    sa = SoilAnalysis(
                        field_id=str(field_id),
                        user_id=int(current_user.id),
                        crop_name=str(crop_name),
                        health_score=parsed.get("health_score"),
                        health_label=parsed.get("health_label"),
                        analysis=parsed,
                    )
                    db.add(sa)
                    db.add(
                        Notification(
                            user_id=int(current_user.id),
                            type="info",
                            title="Soil analysis complete",
                            message=f"AI analysis is ready for {field.name}.",
                        )
                    )
                    await db.commit()
        except Exception:
            # Best-effort: don't fail the UI
            await db.rollback()

        return {"result": text}

@router.post("/plan-tasks")
async def plan_tasks(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 800,
                "system": PACFIS_SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": payload.get("prompt", "")}]
            }
        )
        data = response.json()
        text = data.get("content", [{}])[0].get("text", "{}")

        # Optional notification: frontend can send `field_id`.
        try:
            field_id = payload.get("field_id")
            if field_id:
                # Validate ownership best-effort
                f_q = await db.execute(select(Field).where(Field.id == field_id, Field.user_id == current_user.id))
                field = f_q.scalar_one_or_none()
                db.add(
                    Notification(
                        user_id=int(current_user.id),
                        type="info",
                        title="AI task plan generated",
                        message=f"Tasks are ready for {field.name if field else 'your field'}.",
                    )
                )
                await db.commit()
        except Exception:
            await db.rollback()

        return {"result": text}

@router.post("/predict-yield")
async def predict_yield(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 800,
                "system": PACFIS_SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": payload.get("prompt", "")}]
            }
        )
        data = response.json()
        text = data.get("content", [{}])[0].get("text", "{}")

        # Optional persistence: frontend can send `field_id` + `crop_name`.
        # If missing or JSON is invalid, we still return the AI result for UI rendering.
        try:
            field_id = payload.get("field_id")
            crop_name = payload.get("crop_name") or payload.get("crop")
            parsed = extract_json(text)

            if field_id and crop_name and isinstance(parsed, dict):
                f_q = await db.execute(select(Field).where(Field.id == field_id, Field.user_id == current_user.id))
                field = f_q.scalar_one_or_none()
                if field:
                    def to_float(v):
                        try:
                            return float(v)
                        except Exception:
                            return None

                    predicted_yield = to_float(parsed.get("estimated_yield_tonnes") or parsed.get("predicted_yield"))
                    yield_per_ha = to_float(parsed.get("yield_per_ha"))

                    if predicted_yield is not None:
                        tips = parsed.get("tips_to_improve") or parsed.get("tips")
                        factors = parsed.get("factors")

                        pred = YieldPrediction(
                            field_id=str(field_id),
                            user_id=int(current_user.id),
                            crop_name=str(crop_name),
                            predicted_yield=predicted_yield,
                            yield_per_ha=yield_per_ha,
                            confidence=parsed.get("confidence"),
                            vs_standard=parsed.get("vs_standard"),
                            factors=factors,
                            tips=tips,
                        )
                        db.add(pred)
                        db.add(
                            Notification(
                                user_id=int(current_user.id),
                                type="success",
                                title="Yield prediction complete",
                                message=f"Estimated yield updated for {crop_name}.",
                            )
                        )
                        await db.commit()
        except Exception:
            # Persistence is best-effort: don't fail the AI request.
            pass

        return {"result": text}


class AiChatRequest(BaseModel):
    message: str
    field_id: str | None = None


@router.post("/chat")
async def ai_chat(
    payload: AiChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # Load user's farm context.
    fields = (await db.execute(select(Field).where(Field.user_id == current_user.id))).scalars().all()
    crops = (await db.execute(select(CropAssignment).where(CropAssignment.user_id == current_user.id))).scalars().all()

    if not fields:
        raise HTTPException(status_code=404, detail="No fields found")

    crops_by_field = {c.field_id: c for c in crops}

    chosen_field_id = payload.field_id
    if chosen_field_id:
        if chosen_field_id not in {str(f.id) for f in fields}:
            raise HTTPException(status_code=404, detail="Field not found")
    else:
        # Prefer first field that has a crop assignment.
        chosen_field_id = next(
            (str(f.id) for f in fields if str(f.id) in crops_by_field),
            str(fields[0].id),
        )

    chosen_field = next((f for f in fields if str(f.id) == str(chosen_field_id)), None)
    chosen_crop = crops_by_field.get(chosen_field_id)

    soil_q = (
        select(SoilAnalysis)
        .where(SoilAnalysis.user_id == current_user.id, SoilAnalysis.field_id == str(chosen_field_id))
        .order_by(SoilAnalysis.created_at.desc())
    )
    soil = (await db.execute(soil_q)).scalar_one_or_none()

    context = {
        "farmer": {"id": current_user.id, "email": current_user.email},
        "active_field": {
            "id": str(chosen_field_id),
            "name": chosen_field.name if chosen_field else None,
            "area_sqm": chosen_field.area_sqm if chosen_field else None,
            "coordinates": chosen_field.coordinates if chosen_field else [],
        },
        "crop_assignment": {
            "crop_name": chosen_crop.crop_name if chosen_crop else None,
            "crop_variety": chosen_crop.crop_variety if chosen_crop else None,
            "planting_date": chosen_crop.planting_date if chosen_crop else None,
            "expected_harvest_date": chosen_crop.expected_harvest_date if chosen_crop else None,
            "growth_duration_days": chosen_crop.growth_duration_days if chosen_crop else None,
            "water_requirement": chosen_crop.water_requirement if chosen_crop else None,
            "expected_yield_per_ha": chosen_crop.expected_yield_per_ha if chosen_crop else None,
            "soil_ph_min": chosen_crop.soil_ph_min if chosen_crop else None,
            "soil_ph_max": chosen_crop.soil_ph_max if chosen_crop else None,
            "nitrogen_requirement": chosen_crop.nitrogen_requirement if chosen_crop else None,
            "season": chosen_crop.season if chosen_crop else None,
            "notes": chosen_crop.notes if chosen_crop else None,
        },
        "latest_soil_analysis": soil.analysis if soil else None,
    }

    user_message = payload.message.strip()
    prompt = f"""
You are assisting a farmer using the PAC-FIS system.

Farmer question:
{user_message}

Farm context JSON:
{json.dumps(context, ensure_ascii=False)}

Respond ONLY with JSON:
{{ "reply": <string> }}
"""

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 600,
                "system": PACFIS_SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        data = response.json()
        text = data.get("content", [{}])[0].get("text", "{}")

    parsed = extract_json(text)
    if isinstance(parsed, dict) and parsed.get("reply") is not None:
        return {"reply": parsed.get("reply")}

    # Fallback: return raw model text.
    return {"reply": text}