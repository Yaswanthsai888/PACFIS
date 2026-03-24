import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import useFieldStore from "../../store/fieldStore"
import { getFields } from "../../services/fieldService"
import { getCropForField, assignCrop, deleteCrop } from "../../services/cropService"
import { PRESET_CROPS, SEASONS } from "../../lib/cropData"
import api from "../../services/api"

export default function Crops() {
  const navigate = useNavigate()
  const { fields, setFields } = useFieldStore()
  const [selectedField, setSelectedField] = useState(null)
  const [assignedCrop, setAssignedCrop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [selectedCrop, setSelectedCrop] = useState(null)
  const [plantingDate, setPlantingDate] = useState("")
  const [search, setSearch] = useState("")
  const [filterSeason, setFilterSeason] = useState("All")

  useEffect(() => {
    getFields().then((res) => {
      setFields(res.data)
      if (res.data.length > 0) setSelectedField(res.data[0])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedField) return
    setAssignedCrop(null)
    setAiSuggestion(null)
    getCropForField(selectedField.id)
      .then((res) => setAssignedCrop(res.data))
      .catch(() => setAssignedCrop(null))
  }, [selectedField])

  const handleAssign = async () => {
    if (!selectedCrop || !selectedField) return
    setSaving(true)
    try {
      const plantDate = plantingDate || new Date().toISOString().split("T")[0]
      const harvestDate = new Date(
        new Date(plantDate).getTime() + selectedCrop.growth_duration_days * 86400000
      ).toISOString().split("T")[0]

      const res = await assignCrop({
        field_id: selectedField.id,
        crop_name: selectedCrop.name,
        planting_date: plantDate,
        expected_harvest_date: harvestDate,
        growth_duration_days: selectedCrop.growth_duration_days,
        water_requirement: selectedCrop.water_requirement,
        expected_yield_per_ha: selectedCrop.expected_yield_per_ha,
        soil_ph_min: selectedCrop.soil_ph_min,
        soil_ph_max: selectedCrop.soil_ph_max,
        nitrogen_requirement: selectedCrop.nitrogen_requirement,
        season: selectedCrop.season,
        notes: selectedCrop.notes,
      })
      setAssignedCrop(res.data)
      setSelectedCrop(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!assignedCrop) return
    await deleteCrop(assignedCrop.id)
    setAssignedCrop(null)
  }

const handleAISuggest = async () => {
  if (!selectedField) return
  setAiLoading(true)
  setAiSuggestion(null)
  try {
    const month = new Date().toLocaleString("default", { month: "long" })
    const area = selectedField.area_sqm
      ? `${(selectedField.area_sqm / 10000).toFixed(2)} hectares` : "unknown"

    const prompt = `Suggest TOP 3 crops for this field.
Field: ${selectedField.name}, Area: ${area}, Month: ${month}, Location: Hyderabad, Telangana, India
Respond ONLY as JSON array:
[{ "name": <crop>, "reason": <why>, "yield": <yield/ha>, "soil": <soil req>, "tip": <key tip> }]`

    const res = await api.post("/ai/analyze-soil", { prompt })
    const text = res.data.result
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) setAiSuggestion(JSON.parse(jsonMatch[0]))
  } catch (e) {
    console.error(e)
  } finally {
    setAiLoading(false)
  }
}

  const filteredCrops = PRESET_CROPS.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchSeason = filterSeason === "All" || c.season.includes(filterSeason)
    return matchSearch && matchSeason
  })

  if (loading) return (
    <div style={{ ...styles.container, justifyContent: "center", alignItems: "center", display: "flex" }}>
      <div style={{ color: "#7cd040" }}>Loading...</div>
    </div>
  )

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L8 7H4l4 3-1.5 5L12 12l5.5 3L16 10l4-3h-4L12 2z" fill="#e8ffd0"/>
            </svg>
            <span style={styles.logoText}>Pac-Bot</span>
          </div>
          <div style={styles.sidebarTitle}>Crop Selection</div>
          <div style={styles.sidebarSub}>Assign crops to your fields</div>
        </div>

        {/* Navigation is provided by AppLayout now */}

        {/* Field selector */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Select Field</div>
          {fields.map((f) => (
            <div
              key={f.id}
              style={{ ...styles.fieldCard, ...(selectedField?.id === f.id ? styles.fieldCardActive : {}) }}
              onClick={() => setSelectedField(f)}
            >
              <div style={styles.fieldName}>{f.name}</div>
              <div style={styles.fieldMeta}>
                {f.area_sqm ? `${(f.area_sqm / 10000).toFixed(2)} ha` : "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Assigned crop */}
        {assignedCrop && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Currently Assigned</div>
            <div style={styles.assignedCard}>
              <div style={styles.assignedName}>{assignedCrop.crop_name}</div>
              <div style={styles.assignedMeta}>Season: {assignedCrop.season || "—"}</div>
              <div style={styles.assignedMeta}>Plant: {assignedCrop.planting_date || "—"}</div>
              <div style={styles.assignedMeta}>Harvest: {assignedCrop.expected_harvest_date || "—"}</div>
              <div style={styles.assignedMeta}>Yield: {assignedCrop.expected_yield_per_ha} t/ha</div>
              <button style={styles.removeBtn} onClick={handleDelete}>Remove crop</button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={styles.main}>
        <div style={styles.topBar}>
          <h1 style={styles.pageTitle}>
            {selectedField ? `Crops for: ${selectedField.name}` : "Select a field"}
          </h1>

          {selectedField && (
            <button
              style={styles.aiBtn}
              onClick={handleAISuggest}
              disabled={aiLoading}
            >
              {aiLoading ? "⏳ Analyzing..." : "✨ AI Suggest"}
            </button>
          )}
        </div>

        {/* AI Suggestions */}
        {aiSuggestion && (
          <div style={styles.aiPanel}>
            <div style={styles.aiTitle}>✨ AI Crop Recommendations</div>
            <div style={styles.aiGrid}>
              {aiSuggestion.map((s, i) => (
                <div key={i} style={styles.aiCard}>
                  <div style={styles.aiCropName}>{s.name}</div>
                  <div style={styles.aiReason}>{s.reason}</div>
                  <div style={styles.aiDetail}>Yield: {s.yield}</div>
                  <div style={styles.aiDetail}>Soil: {s.soil}</div>
                  <div style={styles.aiTip}>💡 {s.tip}</div>
                  <button
                    style={styles.selectFromAiBtn}
                    onClick={() => {
                      const found = PRESET_CROPS.find(
                        (c) => c.name.toLowerCase() === s.name.toLowerCase()
                      )
                      if (found) setSelectedCrop(found)
                    }}
                  >
                    Select this crop
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={styles.filterRow}>
          <input
            style={styles.searchInput}
            placeholder="Search crops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={styles.seasonFilters}>
            {["All", "Kharif", "Rabi", "Annual"].map((s) => (
              <button
                key={s}
                style={{ ...styles.seasonBtn, ...(filterSeason === s ? styles.seasonBtnActive : {}) }}
                onClick={() => setFilterSeason(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Crop grid */}
        <div style={styles.cropGrid}>
          {filteredCrops.map((crop) => (
            <div
              key={crop.name}
              style={{
                ...styles.cropCard,
                ...(selectedCrop?.name === crop.name ? styles.cropCardSelected : {}),
              }}
              onClick={() => setSelectedCrop(selectedCrop?.name === crop.name ? null : crop)}
            >
              <div style={styles.cropIcon}>{crop.icon}</div>
              <div style={styles.cropName}>{crop.name}</div>
              <div style={styles.cropSeason}>{crop.season}</div>
              <div style={styles.cropDetails}>
                <div style={styles.cropDetail}>
                  <span style={styles.detailLabel}>Duration</span>
                  <span style={styles.detailVal}>{crop.growth_duration_days}d</span>
                </div>
                <div style={styles.cropDetail}>
                  <span style={styles.detailLabel}>Yield</span>
                  <span style={styles.detailVal}>{crop.expected_yield_per_ha} t/ha</span>
                </div>
                <div style={styles.cropDetail}>
                  <span style={styles.detailLabel}>Water</span>
                  <span style={styles.detailVal}>{crop.water_requirement.split(" ")[0]}</span>
                </div>
                <div style={styles.cropDetail}>
                  <span style={styles.detailLabel}>pH</span>
                  <span style={styles.detailVal}>{crop.soil_ph_min}–{crop.soil_ph_max}</span>
                </div>
              </div>
              <div style={styles.cropNotes}>{crop.notes}</div>
            </div>
          ))}
        </div>

        {/* Assign panel */}
        {selectedCrop && (
          <div style={styles.assignPanel}>
            <div style={styles.assignTitle}>
              Assign {selectedCrop.icon} {selectedCrop.name} to {selectedField?.name}
            </div>
            <div style={styles.assignRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Planting Date</label>
                <input
                  type="date"
                  style={styles.dateInput}
                  value={plantingDate}
                  onChange={(e) => setPlantingDate(e.target.value)}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Est. Harvest</label>
                <div style={styles.dateDisplay}>
                  {plantingDate
                    ? new Date(new Date(plantingDate).getTime() + selectedCrop.growth_duration_days * 86400000)
                        .toISOString().split("T")[0]
                    : `${selectedCrop.growth_duration_days} days from planting`}
                </div>
              </div>
              <button
                style={styles.assignBtn}
                onClick={handleAssign}
                disabled={saving || !selectedField}
              >
                {saving ? "Saving..." : `Assign to ${selectedField?.name || "field"}`}
              </button>
              <button style={styles.cancelBtn} onClick={() => setSelectedCrop(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { display: "flex", minHeight: "100vh", background: "#0d1a0e", fontFamily: "'DM Sans', sans-serif" },
  sidebar: { width: "260px", minWidth: "260px", background: "rgba(8,20,8,0.95)", borderRight: "1px solid rgba(100,180,60,0.15)", display: "flex", flexDirection: "column" },
  sidebarHeader: { padding: "20px 16px 14px", borderBottom: "1px solid rgba(100,180,60,0.1)" },
  logo: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  logoText: { fontSize: "16px", fontWeight: "600", color: "#d4f0a0" },
  sidebarTitle: { fontSize: "15px", fontWeight: "500", color: "#e8f5d0", marginBottom: "3px" },
  sidebarSub: { fontSize: "11px", color: "rgba(160,210,100,0.5)" },
  /* navLinks, navBtn, navBtnActive removed — navigation provided by AppLayout */
  section: { padding: "14px 16px", borderBottom: "1px solid rgba(100,180,60,0.08)" },
  sectionTitle: { fontSize: "10px", fontWeight: "500", color: "rgba(160,210,80,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" },
  fieldCard: { padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(80,150,40,0.15)", background: "rgba(20,50,15,0.4)", marginBottom: "6px", cursor: "pointer" },
  fieldCardActive: { border: "1px solid rgba(120,200,50,0.45)", background: "rgba(40,80,15,0.5)" },
  fieldName: { fontSize: "13px", fontWeight: "500", color: "#d8f0b0" },
  fieldMeta: { fontSize: "11px", color: "rgba(150,210,80,0.45)" },
  assignedCard: { background: "rgba(30,70,15,0.5)", border: "1px solid rgba(100,180,50,0.2)", borderRadius: "8px", padding: "12px" },
  assignedName: { fontSize: "15px", fontWeight: "600", color: "#a0e040", marginBottom: "6px" },
  assignedMeta: { fontSize: "11px", color: "rgba(160,210,100,0.6)", marginBottom: "3px" },
  removeBtn: { marginTop: "8px", padding: "5px 10px", background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,80,80,0.25)", borderRadius: "6px", color: "rgba(240,130,130,0.7)", fontSize: "11px", cursor: "pointer", width: "100%" },
  main: { flex: 1, padding: "24px 28px", overflowY: "auto" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  pageTitle: { fontSize: "22px", fontWeight: "500", color: "#e8f5d0", margin: 0 },
  aiBtn: { padding: "10px 20px", background: "linear-gradient(135deg, #3a3a8a, #6644cc)", border: "1px solid rgba(120,80,220,0.4)", borderRadius: "8px", color: "#ddd0ff", fontSize: "14px", fontWeight: "500", cursor: "pointer" },
  aiPanel: { background: "rgba(20,15,40,0.8)", border: "1px solid rgba(120,80,220,0.3)", borderRadius: "12px", padding: "18px", marginBottom: "20px" },
  aiTitle: { fontSize: "14px", fontWeight: "500", color: "#bb99ff", marginBottom: "14px" },
  aiGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" },
  aiCard: { background: "rgba(30,20,60,0.7)", border: "1px solid rgba(100,60,200,0.25)", borderRadius: "10px", padding: "14px" },
  aiCropName: { fontSize: "15px", fontWeight: "600", color: "#cc99ff", marginBottom: "6px" },
  aiReason: { fontSize: "12px", color: "rgba(200,180,255,0.7)", marginBottom: "8px", lineHeight: "1.5" },
  aiDetail: { fontSize: "11px", color: "rgba(180,160,240,0.6)", marginBottom: "3px" },
  aiTip: { fontSize: "11px", color: "rgba(200,200,100,0.7)", marginTop: "6px", marginBottom: "10px", lineHeight: "1.4" },
  selectFromAiBtn: { width: "100%", padding: "6px", background: "rgba(80,40,160,0.4)", border: "1px solid rgba(120,80,220,0.3)", borderRadius: "6px", color: "#bb99ff", fontSize: "12px", cursor: "pointer" },
  filterRow: { display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" },
  searchInput: { padding: "8px 12px", background: "rgba(20,50,15,0.6)", border: "1px solid rgba(80,150,40,0.25)", borderRadius: "8px", color: "#d8f0b0", fontSize: "13px", outline: "none", width: "200px", fontFamily: "inherit" },
  seasonFilters: { display: "flex", gap: "6px" },
  seasonBtn: { padding: "6px 14px", background: "rgba(20,50,15,0.5)", border: "1px solid rgba(80,150,40,0.2)", borderRadius: "6px", color: "rgba(160,220,80,0.6)", fontSize: "12px", cursor: "pointer" },
  seasonBtnActive: { background: "rgba(50,110,20,0.5)", border: "1px solid rgba(120,200,50,0.4)", color: "#a0e040" },
  cropGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "14px", marginBottom: "24px" },
  cropCard: { background: "rgba(15,35,10,0.8)", border: "1px solid rgba(80,150,40,0.15)", borderRadius: "12px", padding: "16px", cursor: "pointer", transition: "border-color 0.2s" },
  cropCardSelected: { border: "1px solid rgba(120,220,50,0.6)", background: "rgba(30,70,15,0.7)" },
  cropIcon: { fontSize: "28px", marginBottom: "8px" },
  cropName: { fontSize: "15px", fontWeight: "600", color: "#d8f0b0", marginBottom: "2px" },
  cropSeason: { fontSize: "11px", color: "rgba(150,210,80,0.5)", marginBottom: "10px" },
  cropDetails: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "8px" },
  cropDetail: { display: "flex", flexDirection: "column" },
  detailLabel: { fontSize: "9px", color: "rgba(140,200,70,0.45)", textTransform: "uppercase", letterSpacing: "0.5px" },
  detailVal: { fontSize: "12px", color: "#c8e8a0", fontWeight: "500" },
  cropNotes: { fontSize: "11px", color: "rgba(150,200,80,0.45)", lineHeight: "1.4" },
  assignPanel: { position: "sticky", bottom: 0, background: "rgba(8,20,8,0.97)", border: "1px solid rgba(100,200,50,0.25)", borderRadius: "12px", padding: "16px 20px" },
  assignTitle: { fontSize: "14px", fontWeight: "500", color: "#a0e040", marginBottom: "12px" },
  assignRow: { display: "flex", gap: "16px", alignItems: "flex-end" },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "11px", color: "rgba(160,210,80,0.6)", textTransform: "uppercase", letterSpacing: "0.8px" },
  dateInput: { padding: "8px 12px", background: "rgba(20,50,15,0.6)", border: "1px solid rgba(80,150,40,0.25)", borderRadius: "8px", color: "#d8f0b0", fontSize: "13px", outline: "none", fontFamily: "inherit" },
  dateDisplay: { padding: "8px 12px", background: "rgba(20,50,15,0.4)", border: "1px solid rgba(80,150,40,0.15)", borderRadius: "8px", color: "rgba(180,230,100,0.6)", fontSize: "13px" },
  assignBtn: { padding: "10px 20px", background: "linear-gradient(135deg, #3a8a18, #5db82e)", border: "none", borderRadius: "8px", color: "#e8ffd0", fontSize: "14px", fontWeight: "500", cursor: "pointer" },
  cancelBtn: { padding: "10px 16px", background: "none", border: "1px solid rgba(100,180,60,0.2)", borderRadius: "8px", color: "rgba(160,220,80,0.6)", fontSize: "13px", cursor: "pointer" },
}