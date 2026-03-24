import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import useFieldStore from "../../store/fieldStore"
import api from "../../services/api"
import useBotWebSocket from "../../hooks/useBotWebSocket"
import { getFields } from "../../services/fieldService"

// Fix leaflet marker icons.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

export default function Bot() {
  const { fields, activeField, setFields, setActiveField } = useFieldStore()
  const { botState, connectionStatus } = useBotWebSocket()

  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [error, setError] = useState("")
  const [activity, setActivity] = useState([
    { id: "a1", time: new Date().toISOString(), text: "Awaiting bot telemetry..." },
  ])

  const refreshTasks = async () => {
    setLoadingTasks(true)
    setError("")
    try {
      const res = await api.get("/bot/tasks")
      setTasks(res.data || [])
    } catch (e) {
      setError("Failed to load task queue.")
    } finally {
      setLoadingTasks(false)
    }
  }

  useEffect(() => {
    refreshTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!fields || fields.length === 0) {
      getFields()
        .then((res) => {
          setFields(res.data || [])
          if (res.data?.length && !activeField) setActiveField(res.data[0])
        })
        .catch(() => {})
    }
  }, [fields?.length])

  useEffect(() => {
    // Light refresh of tasks for Phase-3 placeholder UI.
    const t = window.setInterval(() => refreshTasks(), 15000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mapCenter = useMemo(() => {
    const coords = activeField?.coordinates
    if (!coords || coords.length === 0) return [17.385, 78.4867]
    const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length
    const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length
    return [avgLat, avgLng]
  }, [activeField?.id, activeField?.coordinates])

  const awaitingConnection = connectionStatus !== "online" || botState.task?.toLowerCase?.().includes("awaiting")
  const batteryPct = Math.floor(botState.battery || 0)
  const speedVal = botState.speed || 0

  const markTask = async (id, status) => {
    try {
      await api.put(`/bot/tasks/${id}`, { status })
      await refreshTasks()
    } catch (e) {
      // ignore
    }
  }

  const cancelTask = async (id) => {
    try {
      await api.delete(`/bot/tasks/${id}`)
      await refreshTasks()
    } catch (e) {
      // ignore
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Bot Status</h1>
          <div style={styles.sub}>
            Phase-3 placeholder: live websocket structure + persisted AI tasks.
          </div>
        </div>

        <div style={styles.badges}>
          <div
            style={{
              ...styles.badge,
              background: awaitingConnection ? "rgba(200,50,50,0.15)" : "rgba(60,140,20,0.15)",
              color: awaitingConnection ? "rgba(240,130,130,0.95)" : "rgba(180,230,100,0.95)",
              border: awaitingConnection
                ? "1px solid rgba(200,80,80,0.25)"
                : "1px solid rgba(120,200,50,0.25)",
            }}
          >
            ● {awaitingConnection ? "Offline" : "Online"}
          </div>
          <div style={styles.statPill}>Battery: {batteryPct}%</div>
          <div style={styles.statPill}>Speed: {speedVal} m/s</div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Live Position</div>
          <div style={styles.mapWrap}>
            <MapContainer center={mapCenter} zoom={17} style={{ width: "100%", height: 240 }}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="© Esri"
              />
              <Marker position={mapCenter}>
                <Popup>Bot last known position (demo)</Popup>
              </Marker>
            </MapContainer>
          </div>
          <div style={styles.mapMeta}>
            Task: <b>{botState.task || "—"}</b>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Task Queue</div>
          {error && <div style={styles.errorBox}>{error}</div>}
          {loadingTasks ? (
            <div style={styles.muted}>Loading…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Task</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.tdMuted}>No tasks yet. Use 3D view to plan and send tasks.</td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.id}>
                        <td style={styles.td}>
                          <div style={styles.taskName}>{t.task_name}</div>
                          {t.description && <div style={styles.taskDesc}>{t.description}</div>}
                        </td>
                        <td style={styles.td}>
                          <div style={{ ...styles.priorityPill, ...priorityColor(t.priority) }}>{t.priority || "normal"}</div>
                        </td>
                        <td style={styles.td}>
                          <div style={{ ...styles.statusPill, ...(t.status === "done" ? styles.statusDone : t.status === "in_progress" ? styles.statusProg : {}) }}>{t.status}</div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            <button
                              style={styles.actionBtn}
                              onClick={() => markTask(t.id, t.status === "done" ? "pending" : "done")}
                            >
                              {t.status === "done" ? "Re-open" : "Mark Done"}
                            </button>
                            <button style={styles.actionBtnDanger} onClick={() => cancelTask(t.id)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Telemetry</div>
          <div style={styles.teleGrid}>
            <div style={styles.teleItem}>
              <div style={styles.teleLabel}>Speed</div>
              <div style={styles.teleVal}>{awaitingConnection ? "Awaiting connection" : `${botState.speed} m/s`}</div>
            </div>
            <div style={styles.teleItem}>
              <div style={styles.teleLabel}>Heading</div>
              <div style={styles.teleVal}>Awaiting connection</div>
            </div>
            <div style={styles.teleItem}>
              <div style={styles.teleLabel}>Motor Status</div>
              <div style={styles.teleVal}>Awaiting connection</div>
            </div>
            <div style={styles.teleItem}>
              <div style={styles.teleLabel}>Sensor Status</div>
              <div style={styles.teleVal}>Awaiting connection</div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Activity Log</div>
          <div style={styles.logList}>
            {activity.map((a) => (
              <div key={a.id} style={styles.logItem}>
                <div style={styles.logTime}>{new Date(a.time).toLocaleTimeString()}</div>
                <div style={styles.logText}>{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function priorityColor(priority) {
  if (priority === "urgent") return { background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,80,80,0.25)", color: "#f08080" }
  if (priority === "normal") return { background: "rgba(200,150,20,0.15)", border: "1px solid rgba(220,170,40,0.25)", color: "#ddaa44" }
  return { background: "rgba(60,140,20,0.15)", border: "1px solid rgba(120,200,50,0.25)", color: "#88cc44" }
}

const styles = {
  page: { padding: "28px 32px", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  h1: { fontSize: 24, fontWeight: 600, color: "#e8f5d0", marginBottom: 6 },
  sub: { fontSize: 13, color: "rgba(160,210,100,0.55)" },
  badges: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
  badge: { padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(100,180,60,0.2)", fontSize: 12, fontWeight: 700 },
  statPill: { padding: "6px 12px", borderRadius: 999, background: "rgba(20,50,15,0.5)", border: "1px solid rgba(100,180,60,0.15)", color: "#d8f0b0", fontSize: 12, fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 },
  card: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(160,220,80,0.6)", fontWeight: 700, marginBottom: 10 },
  mapWrap: { borderRadius: 12, overflow: "hidden", border: "1px solid rgba(100,180,60,0.12)" },
  mapMeta: { marginTop: 10, fontSize: 12, color: "rgba(160,210,100,0.65)" },
  errorBox: { marginBottom: 10, padding: 10, borderRadius: 10, background: "rgba(200,50,50,0.12)", border: "1px solid rgba(200,80,80,0.2)", color: "#f08080", fontSize: 12 },
  muted: { color: "rgba(160,210,100,0.55)", fontSize: 12 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 11, color: "rgba(160,220,80,0.6)", paddingBottom: 8, borderBottom: "1px solid rgba(100,180,60,0.08)" },
  td: { padding: "12px 6px", verticalAlign: "top", borderBottom: "1px solid rgba(100,180,60,0.06)" },
  tdMuted: { color: "rgba(160,210,100,0.55)", fontSize: 12, padding: "12px 6px" },
  taskName: { fontSize: 13, fontWeight: 700, color: "#d8f0b0", marginBottom: 4 },
  taskDesc: { fontSize: 12, color: "rgba(160,210,100,0.6)", lineHeight: 1.4 },
  priorityPill: { padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800 },
  statusPill: { padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,180,60,0.15)", color: "rgba(200,220,200,0.75)" },
  statusDone: { background: "rgba(60,140,20,0.16)", border: "1px solid rgba(120,200,50,0.25)", color: "#88cc44" },
  statusProg: { background: "rgba(200,150,20,0.15)", border: "1px solid rgba(220,170,40,0.25)", color: "#ddaa44" },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  actionBtn: { padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(120,200,50,0.35)", background: "rgba(80,150,40,0.15)", color: "#e8ffd0", cursor: "pointer", fontWeight: 700, fontSize: 12 },
  actionBtnDanger: { padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(200,80,80,0.25)", background: "rgba(200,50,50,0.12)", color: "rgba(240,130,130,0.9)", cursor: "pointer", fontWeight: 700, fontSize: 12 },
  teleGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 },
  teleItem: { borderRadius: 12, padding: 12, background: "rgba(20,50,15,0.4)", border: "1px solid rgba(100,180,60,0.10)" },
  teleLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(160,220,80,0.5)", fontWeight: 700, marginBottom: 6 },
  teleVal: { fontSize: 13, fontWeight: 700, color: "#d8f0b0" },
  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logItem: { padding: 10, borderRadius: 12, background: "rgba(20,15,40,0.25)", border: "1px solid rgba(120,80,220,0.15)" },
  logTime: { fontSize: 11, color: "rgba(160,210,100,0.5)", marginBottom: 4 },
  logText: { fontSize: 12, color: "rgba(180,230,100,0.75)", lineHeight: 1.4 },
}
