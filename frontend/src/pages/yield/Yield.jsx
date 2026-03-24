import { useEffect, useMemo, useState } from "react"
import api from "../../services/api"
import { getFields } from "../../services/fieldService"
import { getCropForField } from "../../services/cropService"
import { predictYield } from "../../services/aiService"

export default function Yield() {
  const [fields, setFields] = useState([])
  const [selectedField, setSelectedField] = useState(null)
  const [crop, setCrop] = useState(null)

  const [loadingFields, setLoadingFields] = useState(true)
  const [loadingPredict, setLoadingPredict] = useState(false)
  const [error, setError] = useState("")

  const [prediction, setPrediction] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    setLoadingFields(true)
    getFields()
      .then((res) => {
        const list = res.data || []
        setFields(list)
        setSelectedField(list[0] || null)
      })
      .catch(() => {})
      .finally(() => setLoadingFields(false))
  }, [])

  useEffect(() => {
    if (!selectedField) return
    setPrediction(null)
    setError("")
    setCrop(null)

    getCropForField(selectedField.id)
      .then((res) => setCrop(res.data || null))
      .catch(() => setCrop(null))

    // Load history for the field.
    api
      .get(`/yield/field/${selectedField.id}`)
      .then((res) => setHistory(res.data || []))
      .catch(() => setHistory([]))
  }, [selectedField?.id])

  const tipsList = useMemo(() => {
    if (!prediction) return []
    return prediction.tips_to_improve || prediction.tips || []
  }, [prediction])

  const factorsList = useMemo(() => {
    if (!prediction) return []
    return prediction.factors || []
  }, [prediction])

  const handlePredict = async () => {
    if (!selectedField) return
    if (!crop) {
      setError("Assign a crop to this field first.")
      return
    }
    setLoadingPredict(true)
    setError("")
    try {
      const res = await predictYield(selectedField, crop, null)
      setPrediction(res || null)
      // Refresh history after a successful prediction.
      const histRes = await api.get(`/yield/field/${selectedField.id}`)
      setHistory(histRes.data || [])
    } catch (e) {
      setError("Yield prediction failed. Please try again.")
    } finally {
      setLoadingPredict(false)
    }
  }

  const impactColor = (impact) => {
    if (impact === "positive") return "rgba(60,140,20,0.8)"
    if (impact === "negative") return "rgba(200,50,50,0.85)"
    return "rgba(200,150,20,0.85)"
  }

  if (loadingFields) {
    return (
      <div style={styles.page}>
        <div style={{ color: "#7cd040" }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Yield Prediction</h1>
          <div style={styles.sub}>AI estimates based on your field and crop assignment.</div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left: selector */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Select Field</div>
          {fields.length === 0 ? (
            <div style={styles.muted}>No fields registered.</div>
          ) : (
            <div style={styles.fieldList}>
              {fields.map((f) => (
                <button
                  key={f.id}
                  style={{
                    ...styles.fieldBtn,
                    ...(selectedField?.id === f.id ? styles.fieldBtnActive : {}),
                  }}
                  onClick={() => setSelectedField(f)}
                >
                  <div style={styles.fieldName}>{f.name}</div>
                  <div style={styles.fieldMeta}>
                    {f.area_sqm ? `${(f.area_sqm / 10000).toFixed(2)} ha` : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, ...styles.hr }} />

          <div style={styles.cardTitle}>Assigned Crop</div>
          {crop ? (
            <div style={styles.cropBox}>
              <div style={styles.cropName}>{crop.crop_name}</div>
              <div style={styles.cropMeta}>Season: {crop.season || "—"}</div>
              <div style={styles.cropMeta}>Plant: {crop.planting_date || "—"}</div>
              <div style={styles.cropMeta}>Harvest: {crop.expected_harvest_date || "—"}</div>
              <div style={styles.cropMeta}>Yield baseline: {crop.expected_yield_per_ha || "—"} t/ha</div>
            </div>
          ) : (
            <div style={styles.muted}>No crop assigned for this field.</div>
          )}

          <div style={{ marginTop: 16 }}>
            <button style={styles.predictBtn} onClick={handlePredict} disabled={loadingPredict || !crop}>
              {loadingPredict ? "⏳ Predicting..." : "Predict Yield ✦"}
            </button>
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
        </div>

        {/* Right: results */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Prediction Result</div>
          {!prediction ? (
            <div style={styles.muted}>Run a prediction to see yield, factors, and recommendations.</div>
          ) : (
            <div>
              <div style={styles.resultHero}>
                <div>
                  <div style={styles.heroLabel}>Estimated total yield</div>
                  <div style={styles.heroValue}>{prediction.estimated_yield_tonnes ?? prediction.predicted_yield ?? "—"} tonnes</div>
                </div>
                <div>
                  <div style={styles.heroLabel}>Yield per hectare</div>
                  <div style={styles.heroValue}>{prediction.yield_per_ha ?? "—"} t/ha</div>
                </div>
              </div>

              <div style={styles.pillsRow}>
                <div style={{ ...styles.pill, ...styles.pillInfo }}>
                  Confidence: {prediction.confidence || "—"}
                </div>
                <div style={{ ...styles.pill, ...styles.pillInfo }}>
                  Comparison: {prediction.vs_standard || "—"}
                </div>
              </div>

              <div style={styles.sectionTitle}>Days until harvest</div>
              <div style={styles.bigLine}>
                {prediction.harvest_readiness ?? prediction.harvestDays ?? "—"} days
              </div>

              <div style={styles.sectionTitle}>Market value estimate</div>
              <div style={styles.bigLine}>
                {prediction.market_value_estimate || "—"}
              </div>

              <div style={styles.sectionTitle}>Factors affecting yield</div>
              <div style={styles.factorList}>
                {factorsList.length === 0 ? (
                  <div style={styles.muted}>No factors provided.</div>
                ) : (
                  factorsList.map((f, i) => (
                    <div key={i} style={styles.factorItem}>
                      <div style={styles.factorTop}>
                        <span style={{ ...styles.factorName, color: impactColor(f.impact) }}>
                          {f.factor || f.name || `Factor ${i + 1}`}
                        </span>
                        <span style={{ ...styles.impactTag, borderColor: impactColor(f.impact), color: impactColor(f.impact) }}>
                          {f.impact}
                        </span>
                      </div>
                      {f.description && <div style={styles.factorDesc}>{f.description}</div>}
                    </div>
                  ))
                )}
              </div>

              <div style={styles.sectionTitle}>Tips to improve yield</div>
              <div style={styles.tipList}>
                {tipsList.length === 0 ? (
                  <div style={styles.muted}>No tips provided.</div>
                ) : (
                  tipsList.map((t, i) => (
                    <div key={i} style={styles.tipItem}>
                      {t}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 22, ...styles.hr }} />

          <div style={styles.cardTitle}>History (this field)</div>
          {history.length === 0 ? (
            <div style={styles.muted}>No saved predictions yet.</div>
          ) : (
            <div style={styles.historyList}>
              {history.slice(0, 10).map((h) => (
                <div key={h.id} style={styles.historyItem}>
                  <div style={styles.historyTop}>
                    <div style={styles.historyCrop}>{h.crop_name}</div>
                    <div style={styles.historyTime}>
                      {h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                  <div style={styles.historyVal}>
                    {h.predicted_yield ?? "—"} tonnes • {h.yield_per_ha ?? "—"} t/ha
                  </div>
                  <div style={styles.historyMeta}>Confidence: {h.confidence || "—"} • {h.vs_standard || ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: "28px 32px", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  h1: { fontSize: 24, fontWeight: 600, color: "#e8f5d0", marginBottom: 6 },
  sub: { fontSize: 13, color: "rgba(160,210,100,0.55)" },

  grid: { display: "grid", gridTemplateColumns: "350px 1fr", gap: 14, alignItems: "start" },

  card: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(160,220,80,0.6)", fontWeight: 700, marginBottom: 12 },
  muted: { color: "rgba(160,210,100,0.55)", fontSize: 13 },
  errorBox: { marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(200,50,50,0.12)", border: "1px solid rgba(200,80,80,0.2)", color: "#f08080", fontSize: 12 },

  fieldList: { display: "flex", flexDirection: "column", gap: 10 },
  fieldBtn: { textAlign: "left", borderRadius: 10, padding: 12, cursor: "pointer", background: "rgba(20,50,15,0.35)", border: "1px solid rgba(80,150,40,0.15)", color: "#e8f5d0" },
  fieldBtnActive: { background: "rgba(60,130,20,0.25)", border: "1px solid rgba(120,200,50,0.45)" },
  fieldName: { fontSize: 13, fontWeight: 700, color: "#d8f0b0" },
  fieldMeta: { fontSize: 12, color: "rgba(160,210,100,0.55)", marginTop: 4 },

  hr: { borderTop: "1px solid rgba(100,180,60,0.08)" },

  cropBox: { background: "rgba(20,50,15,0.45)", borderRadius: 10, padding: 12, border: "1px solid rgba(100,180,60,0.15)" },
  cropName: { fontSize: 18, fontWeight: 700, color: "#a0e040", marginBottom: 8 },
  cropMeta: { fontSize: 12, color: "rgba(160,210,100,0.6)", marginBottom: 4 },

  predictBtn: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #3a8a18, #5db82e)", color: "#e8ffd0", fontWeight: 800, fontSize: 14 },

  resultHero: { display: "flex", gap: 18, padding: 14, borderRadius: 12, background: "rgba(20,50,15,0.45)", border: "1px solid rgba(100,180,60,0.15)", marginBottom: 12 },
  heroLabel: { fontSize: 11, color: "rgba(160,210,100,0.55)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 22, fontWeight: 800, color: "#d8f0b0" },

  pillsRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  pill: { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "1px solid rgba(100,180,60,0.15)", background: "rgba(20,50,15,0.35)", color: "#d8f0b0" },
  pillInfo: { background: "rgba(20,50,15,0.35)" },

  sectionTitle: { marginTop: 14, fontSize: 11, fontWeight: 700, color: "rgba(160,220,80,0.6)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  bigLine: { fontSize: 16, fontWeight: 800, color: "#e8f5d0", marginBottom: 10 },

  factorList: { display: "flex", flexDirection: "column", gap: 10 },
  factorItem: { background: "rgba(20,50,15,0.35)", border: "1px solid rgba(100,180,60,0.12)", borderRadius: 12, padding: 12 },
  factorTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  factorName: { fontSize: 13, fontWeight: 800 },
  impactTag: { fontSize: 11, fontWeight: 800, border: "1px solid rgba(100,180,60,0.2)", padding: "4px 8px", borderRadius: 999 },
  factorDesc: { marginTop: 6, fontSize: 12.5, color: "rgba(160,210,100,0.65)", lineHeight: 1.4 },

  tipList: { display: "flex", flexDirection: "column", gap: 8 },
  tipItem: { padding: "8px 10px", borderRadius: 10, background: "rgba(12,28,10,0.8)", border: "1px solid rgba(80,150,40,0.12)", color: "rgba(180,230,100,0.85)", fontSize: 12.5 },

  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historyItem: { background: "rgba(20,50,15,0.35)", border: "1px solid rgba(100,180,60,0.12)", borderRadius: 12, padding: 12 },
  historyTop: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  historyCrop: { fontSize: 13, fontWeight: 800, color: "#d8f0b0" },
  historyTime: { fontSize: 11, color: "rgba(160,210,100,0.55)" },
  historyVal: { fontSize: 13, fontWeight: 800, color: "#e8f5d0", marginBottom: 4 },
  historyMeta: { fontSize: 12, color: "rgba(160,210,100,0.6)" },
}

