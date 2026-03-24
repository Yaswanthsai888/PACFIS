import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import useFieldStore from "../../store/fieldStore"
import { getFields, createField, updateField as updateFieldApi, deleteField } from "../../services/fieldService"
// and inside the component:

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

function MapClickHandler({ drawing, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (drawing) onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function FieldSelection() {
  const navigate = useNavigate()
  const { fields, activeField, setFields, addField, removeField, updateField, setActiveField } = useFieldStore()
  const [drawing, setDrawing] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState(null)
  const [currentPoints, setCurrentPoints] = useState([])
  const [fieldName, setFieldName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const mapRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    console.log("[FIELDSELECTION] useEffect: token in localStorage:", token ? token.substring(0, 20) + "..." : "NOT FOUND")
    
    if (!token) {
      console.warn("[FIELDSELECTION] No token found, skipping getFields()")
      setError("Not authenticated")
      return
    }
    
    getFields()
      .then((res) => {
        console.log("[FIELDSELECTION] getFields() success:", res.data)
        setFields(res.data)
      })
      .catch((err) => {
        console.error("[FIELDSELECTION] getFields() failed:", err)
      })
  }, [])

  const calcArea = (coords) => {
    if (coords.length < 3) return 0
    let area = 0
    const n = coords.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const xi = coords[i].lng * (Math.PI / 180) * Math.cos(coords[i].lat * Math.PI / 180) * 6371000
      const yi = coords[i].lat * (Math.PI / 180) * 6371000
      const xj = coords[j].lng * (Math.PI / 180) * Math.cos(coords[j].lat * Math.PI / 180) * 6371000
      const yj = coords[j].lat * (Math.PI / 180) * 6371000
      area += xi * yj - xj * yi
    }
    return Math.abs(area / 2)
  }

  const handleSave = async () => {
    if (!fieldName.trim()) return setError("Please enter a field name")
    if (currentPoints.length < 3) return setError("Please place at least 3 points")
    setLoading(true)
    setError("")
    try {
      const area = calcArea(currentPoints)
      if (editingFieldId) {
        const res = await updateFieldApi(editingFieldId, { name: fieldName, coordinates: currentPoints, area_sqm: area })
        updateField(res.data)
        setActiveField(res.data)
      } else {
        const res = await createField({ name: fieldName, coordinates: currentPoints, area_sqm: area })
        addField(res.data)
      }

      setCurrentPoints([])
      setFieldName("")
      setDrawing(false)
      setEditingFieldId(null)
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      setError("Failed to save field")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteField(id)
    removeField(id)
  }

  const handleEdit = (field) => {
    setEditingFieldId(field.id)
    setFieldName(field.name || "")
    setCurrentPoints(field.coordinates || [])
    setDrawing(true)
    setError("")
    setActiveField(field)
    // Optionally fly to the field center for convenience.
    if (mapRef.current && field.coordinates?.length > 0) {
      const lats = field.coordinates.map((c) => c.lat)
      const lngs = field.coordinates.map((c) => c.lng)
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      mapRef.current.flyTo([centerLat, centerLng], 18, { animate: true, duration: 1.8 })
    }
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 0px)", position: "relative" }}>
      {/* Floating control panel */}
      <div style={styles.floatingPanel}>
        <div style={styles.panelHeader}>
          <div style={styles.sidebarTitle}>Field Manager</div>
          <div style={styles.sidebarSub}>Draw and manage boundaries</div>
        </div>

        <div style={styles.section}>
          {!drawing ? (
            <button
              style={styles.btnPrimary}
              onClick={() => {
                setDrawing(true)
                setEditingFieldId(null)
                setCurrentPoints([])
                setFieldName("")
                setError("")
              }}
            >
              + New Field
            </button>
          ) : (
            <div>
              <input
                style={styles.input}
                placeholder="Field name (e.g. North Plot)"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
              />
              <div style={styles.hint}>Click on the map to place boundary points. Min 3 points.</div>
              <div style={styles.pointCount}>{currentPoints.length} point{currentPoints.length !== 1 ? "s" : ""} placed</div>
              {error && <div style={styles.error}>{error}</div>}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button style={styles.btnPrimary} onClick={handleSave} disabled={loading}>
                  {loading ? "Saving..." : editingFieldId ? "Update Field" : "Save Field"}
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => {
                    setDrawing(false)
                    setCurrentPoints([])
                    setFieldName("")
                    setEditingFieldId(null)
                    setError("")
                  }}
                >
                  Cancel
                </button>
              </div>
              {currentPoints.length > 0 && (
                <button style={{ ...styles.btnSecondary, marginTop: "6px", width: "100%" }}
                  onClick={() => setCurrentPoints((p) => p.slice(0, -1))}>
                  Undo Last Point
                </button>
              )}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Your Fields ({fields.length})</div>
          {fields.length === 0 && <div style={styles.emptyText}>No fields yet.</div>}
          {fields.map((field) => (
            <div
              key={field.id}
              style={{ ...styles.fieldCard, ...(activeField?.id === field.id ? styles.fieldCardActive : {}) }}
              onClick={() => {
                setActiveField(field)
                if (mapRef.current && field.coordinates.length > 0) {
                  const lats = field.coordinates.map((c) => c.lat)
                  const lngs = field.coordinates.map((c) => c.lng)
                  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
                  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
                  mapRef.current.flyTo([centerLat, centerLng], 18, { animate: true, duration: 1.8 })
                }
              }}
            >
              <div style={styles.fieldName}>{field.name}</div>
              <div style={styles.fieldMeta}>
                {field.coordinates.length} pts
                {field.area_sqm && ` · ${(field.area_sqm / 10000).toFixed(2)} ha`}
              </div>
              <button
                style={styles.editBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(field)
                }}
              >
                ✎
              </button>
              <button
                style={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(field.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button style={{ ...styles.btnPrimary, margin: "0 16px 16px", background: "rgba(40,60,160,0.4)", border: "1px solid rgba(100,130,255,0.3)" }}
          onClick={() => navigate("/field/3d")}>
          View in 3D ◈
        </button>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[17.385, 78.4867]} zoom={17} style={{ width: "100%", height: "100%" }} ref={mapRef}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="© Esri"
          />
          <MapClickHandler drawing={drawing} onAddPoint={(p) => setCurrentPoints((prev) => [...prev, p])} />
          {fields.map((field) => (
            <Polygon key={field.id} positions={field.coordinates.map((c) => [c.lat, c.lng])}
              pathOptions={{ color: activeField?.id === field.id ? "#7cd040" : "#4a9a20", fillColor: activeField?.id === field.id ? "#7cd040" : "#4a9a20", fillOpacity: 0.25, weight: 2 }} />
          ))}
          {currentPoints.length > 1 && (
            <Polygon positions={currentPoints.map((c) => [c.lat, c.lng])}
              pathOptions={{ color: "#f0c040", fillColor: "#f0c040", fillOpacity: 0.2, weight: 2, dashArray: "6 4" }} />
          )}
          {currentPoints.map((pt, i) => (
            <Marker
              key={i}
              position={[pt.lat, pt.lng]}
              draggable={!!editingFieldId}
              eventHandlers={
                editingFieldId
                  ? {
                      dragend: (e) => {
                        const ll = e.target.getLatLng()
                        setCurrentPoints((prev) =>
                          prev.map((p, idx) =>
                            idx === i ? { lat: ll.lat, lng: ll.lng } : p
                          )
                        )
                      },
                    }
                  : undefined
              }
            />
          ))}
        </MapContainer>
        {drawing && (
          <div style={styles.mapHint}>Drawing mode — click to add boundary points</div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: "flex", height: "100vh", background: "#0d1a0e", fontFamily: "'DM Sans', sans-serif",
  },
  floatingPanel: {
    width: "260px", minWidth: "260px",
    background: "rgba(6,16,6,0.96)",
    borderRight: "1px solid rgba(100,180,60,0.12)",
    overflowY: "auto", display: "flex", flexDirection: "column",
    zIndex: 10,
  },
  panelHeader: {
    padding: "18px 16px 14px",
    borderBottom: "1px solid rgba(100,180,60,0.08)",
  },
  sidebarTitle: { fontSize: "16px", fontWeight: "500", color: "#e8f5d0", marginBottom: "4px" },
  sidebarSub: { fontSize: "12px", color: "rgba(160,210,100,0.55)" },
  section: { padding: "16px 20px", borderBottom: "1px solid rgba(100,180,60,0.08)" },
  sectionTitle: { fontSize: "12px", fontWeight: "500", color: "rgba(180,230,100,0.6)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" },
  btnPrimary: {
    width: "100%", padding: "10px", background: "linear-gradient(135deg, #3a8a18 0%, #5db82e 100%)",
    border: "none", borderRadius: "8px", color: "#e8ffd0", fontSize: "14px",
    fontWeight: "500", cursor: "pointer",
  },
  btnSecondary: {
    flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(100,180,60,0.2)", borderRadius: "8px",
    color: "rgba(180,230,100,0.7)", fontSize: "13px", cursor: "pointer",
  },
  input: {
    width: "100%", padding: "10px 12px", background: "rgba(20,50,15,0.6)",
    border: "1px solid rgba(80,150,40,0.25)", borderRadius: "8px",
    color: "#d8f0b0", fontSize: "13px", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", marginBottom: "8px",
  },
  hint: { fontSize: "12px", color: "rgba(160,210,100,0.5)", lineHeight: "1.5", marginBottom: "6px" },
  pointCount: { fontSize: "13px", color: "#7cd040", fontWeight: "500" },
  error: { fontSize: "12px", color: "#f08080", marginTop: "6px" },
  fieldCard: {
    position: "relative", padding: "12px", borderRadius: "8px",
    border: "1px solid rgba(80,150,40,0.15)", background: "rgba(20,50,15,0.4)",
    marginBottom: "8px", cursor: "pointer", transition: "border-color 0.2s",
  },
  fieldCardActive: { border: "1px solid rgba(100,200,50,0.5)", background: "rgba(30,70,15,0.6)" },
  fieldName: { fontSize: "14px", fontWeight: "500", color: "#d8f0b0", marginBottom: "2px" },
  fieldMeta: { fontSize: "12px", color: "rgba(150,210,80,0.5)" },
  deleteBtn: {
    position: "absolute", top: "10px", right: "10px",
    background: "none", border: "none", color: "rgba(200,80,80,0.5)",
    cursor: "pointer", fontSize: "12px", padding: "2px 4px",
  },
  editBtn: {
    position: "absolute", top: "10px", left: "10px",
    background: "none", border: "none", color: "rgba(160,220,80,0.5)",
    cursor: "pointer", fontSize: "12px", padding: "2px 4px",
  },
  emptyText: { fontSize: "13px", color: "rgba(150,210,80,0.35)", lineHeight: "1.6" },
  mapWrapper: { flex: 1, position: "relative" },
  mapHint: {
    position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)",
    background: "rgba(8,20,8,0.9)", border: "1px solid rgba(100,180,60,0.3)",
    borderRadius: "8px", padding: "8px 16px", color: "#a0e040",
    fontSize: "13px", zIndex: 1000, pointerEvents: "none",
  },
}