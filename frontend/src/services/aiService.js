import api from "./api"

const PACFIS_SYSTEM_PROMPT = `You are PAC-FIS...` // keep this for prompt building only

async function callPacFis(endpoint, payload) {
  const res = await api.post(`/ai/${endpoint}`, payload)
  const text = res.data.result
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  }
}

export async function analyzeSoil(fieldData, cropData, soilZones) {
  const zonesSummary = Object.entries(soilZones)
    .map(([row, status]) => `Row ${row}: ${status}`).join(", ")
  const healthyCnt = Object.values(soilZones).filter(s => s === "healthy").length
  const wetCnt = Object.values(soilZones).filter(s => s === "wet").length
  const dryCnt = Object.values(soilZones).filter(s => s === "dry").length
  const total = Object.values(soilZones).length || 1

  const prompt = `Analyze the soil health for this farm field.

FIELD: ${fieldData.name}, ${fieldData.area_sqm ? (fieldData.area_sqm/10000).toFixed(2) + ' ha' : 'unknown'}
LOCATION: Telangana, India
ZONES: ${total} total — ${healthyCnt} healthy, ${wetCnt} wet, ${dryCnt} dry
ZONE DETAIL: ${zonesSummary || 'No zones scanned yet'}
CROP: ${cropData?.crop_name || 'None'}, water req: ${cropData?.water_requirement || 'unknown'}
SOIL pH NEEDED: ${cropData?.soil_ph_min || '?'}-${cropData?.soil_ph_max || '?'}
NITROGEN REQ: ${cropData?.nitrogen_requirement || 'unknown'}

Respond ONLY with JSON:
{
  "health_score": <0-100>,
  "health_label": <"Critical"|"Poor"|"Fair"|"Good"|"Excellent">,
  "summary": <2 sentence assessment>,
  "zones": {
    "healthy_advice": <advice for healthy zones>,
    "wet_advice": <advice for wet zones or null>,
    "dry_advice": <advice for dry zones or null>
  },
  "recommendations": [{ "priority": "high"|"medium"|"low", "action": <string>, "reason": <string> }],
  "fertilizer": { "needed": <bool>, "type": <string|null>, "amount": <string|null>, "timing": <string|null> },
  "water": { "status": "optimal"|"deficit"|"excess", "action": <string>, "schedule": <string> },
  "risks": [{ "type": <string>, "severity": "high"|"medium"|"low", "description": <string> }],
  "bot_tasks": [<string>]
}`

  return callPacFis("analyze-soil", {
    prompt,
    field_id: fieldData?.id,
    crop_name: cropData?.crop_name,
  })
}

export async function planTasks(fieldData, cropData, soilAnalysis, botState) {
  const prompt = `Create a prioritized task plan for the farming robot.

FIELD: ${fieldData.name}, ${fieldData.area_sqm ? (fieldData.area_sqm/10000).toFixed(2) + ' ha' : 'unknown'}
CROP: ${cropData?.crop_name || 'None'}, planted: ${cropData?.planting_date || 'not yet'}
SOIL HEALTH: ${soilAnalysis?.health_score || 'unknown'}/100 — ${soilAnalysis?.health_label || ''}
BOT BATTERY: ${botState?.battery ? Math.floor(botState.battery) + '%' : 'unknown'}
COMPLETED ROWS: ${botState?.completedRows?.length || 0}
WATER STATUS: ${soilAnalysis?.water?.status || 'unknown'}

Respond ONLY with JSON:
{
  "current_task": <what to do RIGHT NOW>,
  "task_queue": [{ "order": 1, "task": <name>, "description": <details>, "estimated_minutes": <number>, "priority": "urgent"|"normal"|"low" }],
  "reasoning": <1-2 sentences>
}`

  return callPacFis("plan-tasks", {
    prompt,
    field_id: fieldData?.id,
    crop_name: cropData?.crop_name,
  })
}

export async function predictYield(fieldData, cropData, soilAnalysis) {
  const prompt = `Predict crop yield for this field.

FIELD: ${fieldData.name}, ${fieldData.area_sqm ? (fieldData.area_sqm/10000).toFixed(2) + ' ha' : 'unknown'}
CROP: ${cropData?.crop_name || 'unknown'}
PLANTING: ${cropData?.planting_date || 'unknown'}
HARVEST: ${cropData?.expected_harvest_date || 'unknown'}
STANDARD YIELD: ${cropData?.expected_yield_per_ha || 'unknown'} t/ha
SOIL HEALTH: ${soilAnalysis?.health_score || 50}/100
WATER: ${soilAnalysis?.water?.status || 'unknown'}

Respond ONLY with JSON:
{
  "estimated_yield_tonnes": <number>,
  "yield_per_ha": <number>,
  "confidence": "low"|"medium"|"high",
  "vs_standard": <e.g. "+12%" or "-8%">,
  "factors": [{ "factor": <name>, "impact": "positive"|"negative"|"neutral", "description": <string> }],
  "harvest_readiness": <days until harvest>,
  "market_value_estimate": <INR range per tonne>,
  "tips_to_improve": [<string>]
}`

  return callPacFis("predict-yield", {
    prompt,
    field_id: fieldData?.id,
    crop_name: cropData?.crop_name,
  })
}