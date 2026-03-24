import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import { getFields } from "../../services/fieldService"
import { getCrops } from "../../services/cropService"
import api from "../../services/api"
import { getNotifications } from "../../services/notificationService"

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    fieldCount: 0,
    totalArea: 0,
    activeCrop: null,
    cropCount: 0,
    botWorking: false,
    nextTask: null,
    activity: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getFields(), getCrops(), api.get("/bot/tasks"), getNotifications()])
      .then(([fieldsRes, cropsRes, tasksRes, notifRes]) => {
        const fields = fieldsRes.data || []
        const crops = cropsRes.data || []
        const tasks = tasksRes.data || []
        const notifications = notifRes.data || []

        const totalArea = fields.reduce((s, f) => s + (f.area_sqm || 0), 0)
        const latestCrop = crops.length > 0 ? crops[crops.length - 1] : null

        const botWorking = tasks.some((t) => t.status === "in_progress")
        const pendingTasks = tasks
          .filter((t) => t.status === "pending")
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const nextTask = pendingTasks[0] || null

        const activity = [...notifications]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)

        setStats({
          fieldCount: fields.length,
          totalArea,
          activeCrop: latestCrop,
          cropCount: crops.length,
          botWorking,
          nextTask,
          activity,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.greeting}>{greeting}, {user?.first_name} 👋</h1>
          <p style={styles.greetingSub}>Here's what's happening on your farm today.</p>
        </div>
        <div style={styles.statusBadge}>● System Online</div>
      </div>

      {/* Stat cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Fields</div>
          <div style={styles.statValue}>{loading ? "—" : stats.fieldCount}</div>
          <div style={styles.statSub}>
            {stats.fieldCount === 0 ? "No fields yet" : `${(stats.totalArea / 10000).toFixed(2)} ha total`}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active Crops</div>
          <div style={styles.statValue}>{loading ? "—" : stats.cropCount}</div>
          <div style={styles.statSub}>
            {stats.activeCrop ? stats.activeCrop.crop_name : "No crops assigned"}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Bot Status</div>
          <div style={{ ...styles.statValue, color: stats.botWorking ? "#6cc030" : "#ddaa44" }}>
            {stats.botWorking ? "Working" : "Standby"}
          </div>
          <div style={styles.statSub}>{stats.nextTask ? `Next: ${stats.nextTask.task_name}` : "No tasks queued"}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Next Task</div>
          <div style={styles.statValue}>
            {loading ? "—" : stats.nextTask?.task_name ? stats.nextTask.task_name : "—"}
          </div>
          <div style={styles.statSub}>
            {stats.nextTask?.status ? `Status: ${stats.nextTask.status}` : "Plan tasks from 3D view"}
          </div>
        </div>
      </div>

      {/* Active crop detail */}
      {stats.activeCrop && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Active Crop</div>
          <div style={styles.cropCard}>
            <div style={styles.cropLeft}>
              <div style={styles.cropName}>{stats.activeCrop.crop_name}</div>
              <div style={styles.cropMeta}>Season: {stats.activeCrop.season || "—"}</div>
              <div style={styles.cropMeta}>Planted: {stats.activeCrop.planting_date || "—"}</div>
              <div style={styles.cropMeta}>Harvest: {stats.activeCrop.expected_harvest_date || "—"}</div>
              <div style={styles.cropMeta}>
                Expected yield: {stats.activeCrop.expected_yield_per_ha} t/ha
              </div>
            </div>
            <div style={styles.cropRight}>
              <div style={styles.cropDetail}>
                <span style={styles.detailLabel}>Water needs</span>
                <span style={styles.detailVal}>{stats.activeCrop.water_requirement || "—"}</span>
              </div>
              <div style={styles.cropDetail}>
                <span style={styles.detailLabel}>Soil pH</span>
                <span style={styles.detailVal}>
                  {stats.activeCrop.soil_ph_min}–{stats.activeCrop.soil_ph_max}
                </span>
              </div>
              <div style={styles.cropDetail}>
                <span style={styles.detailLabel}>Nitrogen</span>
                <span style={styles.detailVal}>{stats.activeCrop.nitrogen_requirement || "—"}</span>
              </div>
              <div style={styles.cropDetail}>
                <span style={styles.detailLabel}>Duration</span>
                <span style={styles.detailVal}>{stats.activeCrop.growth_duration_days} days</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Recent Activity</div>
        {stats.activity.length === 0 ? (
          <div style={styles.muted}>No recent notifications.</div>
        ) : (
          <div style={styles.activityList}>
            {stats.activity.map((n) => (
              <div key={n.id} style={styles.activityItem}>
                <div style={{ ...styles.activityDot, ...activityDotColor(n.type) }} />
                <div style={styles.activityBody}>
                  <div style={styles.activityTitleRow}>
                    <div style={styles.activityTitle}>{n.title}</div>
                    <div style={styles.activityTime}>
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                  <div style={styles.activityMsg}>{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Quick Actions</div>
        <div style={styles.actionsGrid}>
          {[
            { icon: "⬡", label: "Manage Fields", sub: "Draw and register boundaries", path: "/fields" },
            { icon: "◈", label: "3D Field View", sub: "See your field in real-time 3D", path: "/field/3d" },
            { icon: "⚘", label: "Crop Selection", sub: "Assign crops with AI guidance", path: "/crops" },
            { icon: "⊙", label: "Bot Status", sub: "Monitor Pac-Bot activity", path: "/bot" },
          ].map((action) => (
            <button
              key={action.path}
              style={styles.actionCard}
              onClick={() => navigate(action.path)}
            >
              <div style={styles.actionIcon}>{action.icon}</div>
              <div style={styles.actionLabel}>{action.label}</div>
              <div style={styles.actionSub}>{action.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Empty state guidance */}
      {!loading && stats.fieldCount === 0 && (
        <div style={styles.emptyBanner}>
          <div style={styles.emptyTitle}>Welcome to Pac-Bot!</div>
          <div style={styles.emptySub}>
            Start by drawing your first field boundary on the map, then assign a crop and let AI guide the rest.
          </div>
          <button style={styles.startBtn} onClick={() => navigate("/fields")}>
            Register your first field →
          </button>
        </div>
      )}
    </div>
  )
}

function activityDotColor(type) {
  if (type === "success") return { background: "#6cc030" }
  if (type === "warning") return { background: "#ddaa44" }
  if (type === "error") return { background: "#cc3333" }
  return { background: "#66aaff" }
}

const styles = {
  page: { padding: "28px 32px", minHeight: "100vh" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" },
  greeting: { fontSize: "24px", fontWeight: "500", color: "#e8f5d0", margin: 0, marginBottom: "4px" },
  greetingSub: { fontSize: "13px", color: "rgba(160,210,100,0.5)", margin: 0 },
  statusBadge: { fontSize: "12px", color: "#6cc030", background: "rgba(60,140,20,0.12)", border: "0.5px solid rgba(80,160,30,0.22)", borderRadius: "20px", padding: "5px 12px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "28px" },
  statCard: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: "12px", padding: "18px" },
  statLabel: { fontSize: "11px", color: "rgba(160,210,100,0.5)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" },
  statValue: { fontSize: "26px", fontWeight: "500", color: "#d8f0b0", marginBottom: "4px" },
  statSub: { fontSize: "11px", color: "rgba(150,200,80,0.4)" },
  section: { marginBottom: "24px" },
  sectionTitle: { fontSize: "11px", fontWeight: "500", color: "rgba(160,210,80,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" },
  cropCard: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: "12px", padding: "18px 20px", display: "flex", gap: "32px" },
  cropLeft: { flex: 1 },
  cropRight: { flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" },
  cropName: { fontSize: "18px", fontWeight: "500", color: "#a0e040", marginBottom: "8px" },
  cropMeta: { fontSize: "12px", color: "rgba(160,210,100,0.55)", marginBottom: "4px" },
  cropDetail: { display: "flex", flexDirection: "column" },
  detailLabel: { fontSize: "10px", color: "rgba(140,200,70,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" },
  detailVal: { fontSize: "13px", color: "#c8e8a0", fontWeight: "500" },
  muted: { fontSize: 13, color: "rgba(160,210,100,0.55)" },
  actionsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" },
  actionCard: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: "12px", padding: "18px", cursor: "pointer", textAlign: "left" },
  actionIcon: { fontSize: "22px", marginBottom: "10px", color: "#7cd040" },
  actionLabel: { fontSize: "13px", fontWeight: "500", color: "#d8f0b0", marginBottom: "4px" },
  actionSub: { fontSize: "11px", color: "rgba(150,200,80,0.4)", lineHeight: "1.5" },
  emptyBanner: { background: "rgba(20,50,10,0.5)", border: "0.5px solid rgba(100,180,50,0.2)", borderRadius: "14px", padding: "28px 32px" },
  emptyTitle: { fontSize: "18px", fontWeight: "500", color: "#e8f5d0", marginBottom: "8px" },
  emptySub: { fontSize: "13px", color: "rgba(160,210,100,0.55)", marginBottom: "16px", lineHeight: "1.6", maxWidth: "500px" },
  startBtn: { padding: "10px 22px", background: "linear-gradient(135deg, #3a8a18, #5db82e)", border: "none", borderRadius: "8px", color: "#e8ffd0", fontSize: "14px", fontWeight: "500", cursor: "pointer" },

  activityList: { display: "flex", flexDirection: "column", gap: 10 },
  activityItem: { display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, border: "0.5px solid rgba(80,150,40,0.12)", background: "rgba(12,28,10,0.7)" },
  activityDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0, marginTop: 6 },
  activityBody: { flex: 1, minWidth: 0 },
  activityTitleRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  activityTitle: { fontSize: 13, fontWeight: 700, color: "#d8f0b0" },
  activityTime: { fontSize: 11, color: "rgba(160,210,100,0.55)", flexShrink: 0 },
  activityMsg: { fontSize: 12, color: "rgba(160,210,100,0.65)", lineHeight: 1.4, marginTop: 6 },
}