import { useEffect, useMemo, useState } from "react"
import api from "../../services/api"

export default function Profile() {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    farm_name: "",
    location_city: "",
    location_state: "",
    language: "English",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [aiConfigured, setAiConfigured] = useState(null)

  const [pw, setPw] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [pwSaving, setPwSaving] = useState(false)

  const [exportJson, setExportJson] = useState("")
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const profRes = await api.get("/auth/profile")
        const aiRes = await api.get("/ai/status")
        setProfile({
          first_name: profRes.data.first_name || "",
          last_name: profRes.data.last_name || "",
          farm_name: profRes.data.farm_name || "",
          location_city: profRes.data.location_city || "",
          location_state: profRes.data.location_state || "",
          language: profRes.data.language || "English",
        })
        setAiConfigured(!!aiRes.data?.configured)
      } catch (e) {
        setError("Failed to load profile.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const languages = useMemo(() => ["English", "Telugu", "Hindi"], [])

  const handleUpdateProfile = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await api.put("/auth/profile", {
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        farm_name: profile.farm_name || null,
        location_city: profile.location_city || null,
        location_state: profile.location_state || null,
        language: profile.language || null,
      })
      setSuccess("Profile updated.")
    } catch (e) {
      setError(e.response?.data?.detail || "Profile update failed.")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwSaving(true)
    setError("")
    setSuccess("")
    try {
      await api.post("/auth/change-password", pw)
      setSuccess("Password updated.")
      setPw({ current_password: "", new_password: "", confirm_password: "" })
    } catch (e) {
      setError(e.response?.data?.detail || "Password change failed.")
    } finally {
      setPwSaving(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    setError("")
    setExportJson("")
    try {
      const [fieldsRes, cropsRes, yieldRes, tasksRes, notifRes] = await Promise.all([
        api.get("/fields/"),
        api.get("/crops/"),
        api.get("/yield/history"),
        api.get("/bot/tasks"),
        api.get("/notifications"),
      ])

      const data = {
        exported_at: new Date().toISOString(),
        fields: fieldsRes.data || [],
        crops: cropsRes.data || [],
        yield_predictions: yieldRes.data || [],
        bot_tasks: tasksRes.data || [],
        notifications: notifRes.data || [],
      }

      setExportJson(JSON.stringify(data, null, 2))
    } catch (e) {
      setError("Export failed.")
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    const ok = window.confirm("Delete your account? This cannot be undone.")
    if (!ok) return
    setError("")
    setSuccess("")
    try {
      // Backend may not have this endpoint yet; handle gracefully.
      await api.delete("/auth/account")
      localStorage.removeItem("token")
      window.location.href = "/login"
    } catch (e) {
      setError("Delete account is not available yet.")
    }
  }

  if (loading) {
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
          <h1 style={styles.h1}>Profile & Settings</h1>
          <div style={styles.sub}>Manage your farm details and account security.</div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Profile</div>
          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          <div style={styles.formGrid}>
            <label style={styles.label}>First name</label>
            <input style={styles.input} value={profile.first_name} onChange={(e) => setProfile((s) => ({ ...s, first_name: e.target.value }))} />

            <label style={styles.label}>Last name</label>
            <input style={styles.input} value={profile.last_name} onChange={(e) => setProfile((s) => ({ ...s, last_name: e.target.value }))} />

            <label style={styles.label}>Farm name</label>
            <input style={styles.input} value={profile.farm_name} onChange={(e) => setProfile((s) => ({ ...s, farm_name: e.target.value }))} />

            <label style={styles.label}>City</label>
            <input style={styles.input} value={profile.location_city} onChange={(e) => setProfile((s) => ({ ...s, location_city: e.target.value }))} />

            <label style={styles.label}>State</label>
            <input style={styles.input} value={profile.location_state} onChange={(e) => setProfile((s) => ({ ...s, location_state: e.target.value }))} />

            <label style={styles.label}>Preferred language</label>
            <select style={styles.input} value={profile.language} onChange={(e) => setProfile((s) => ({ ...s, language: e.target.value }))}>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <button style={styles.primaryBtn} onClick={handleUpdateProfile} disabled={saving}>
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Security</div>

          <div style={styles.subBox}>
            <div style={styles.subBoxTitle}>Change password</div>
            <div style={styles.formGrid}>
              <label style={styles.label}>Current password</label>
              <input type="password" style={styles.input} value={pw.current_password} onChange={(e) => setPw((s) => ({ ...s, current_password: e.target.value }))} />

              <label style={styles.label}>New password</label>
              <input type="password" style={styles.input} value={pw.new_password} onChange={(e) => setPw((s) => ({ ...s, new_password: e.target.value }))} />

              <label style={styles.label}>Confirm password</label>
              <input type="password" style={styles.input} value={pw.confirm_password} onChange={(e) => setPw((s) => ({ ...s, confirm_password: e.target.value }))} />
            </div>

            <button style={styles.primaryBtn} onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? "Updating..." : "Update Password"}
            </button>
          </div>

          <div style={{ marginTop: 14 }} />

          <div style={styles.subBox}>
            <div style={styles.subBoxTitle}>AI API key status</div>
            <div style={styles.aiStatus}>
              <span
                style={{
                  ...styles.statusDot,
                  background: aiConfigured ? "rgba(60,140,20,0.25)" : "rgba(200,50,50,0.25)",
                  border: `1px solid ${aiConfigured ? "rgba(120,200,50,0.35)" : "rgba(240,80,80,0.35)"}`,
                }}
              />
              <div style={styles.aiStatusText}>
                {aiConfigured ? "Configured (AI enabled)" : "Not configured (AI disabled)"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }} />

          <div style={styles.subBox}>
            <div style={styles.subBoxTitle}>Data</div>
            <button style={styles.secondaryBtn} onClick={handleExport} disabled={exportLoading}>
              {exportLoading ? "Exporting..." : "Export all data as JSON"}
            </button>

            {exportJson ? (
              <textarea style={styles.textarea} value={exportJson} readOnly />
            ) : (
              <div style={styles.muted}>Click export to generate a JSON snapshot.</div>
            )}
          </div>

          <div style={{ marginTop: 14 }} />

          <button style={styles.dangerBtn} onClick={handleDeleteAccount}>
            Delete account
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: "28px 32px", minHeight: "100vh" },
  header: { marginBottom: 18 },
  h1: { fontSize: 24, fontWeight: 600, color: "#e8f5d0", marginBottom: 6 },
  sub: { fontSize: 13, color: "rgba(160,210,100,0.55)" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "rgba(12,28,10,0.9)", border: "0.5px solid rgba(80,150,40,0.15)", borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(160,220,80,0.6)", fontWeight: 700, marginBottom: 12 },
  label: { fontSize: 11, color: "rgba(160,210,100,0.6)", textTransform: "uppercase", letterSpacing: "0.7px", marginTop: 10 },
  input: { width: "100%", padding: "10px 12px", background: "rgba(20,50,15,0.6)", border: "1px solid rgba(80,150,40,0.25)", borderRadius: 8, color: "#d8f0b0", outline: "none", fontFamily: "inherit", fontSize: 13 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" },

  primaryBtn: { marginTop: 14, width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #3a8a18, #5db82e)", color: "#e8ffd0", fontWeight: 800, fontSize: 14 },
  secondaryBtn: { marginTop: 14, width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(100,180,60,0.25)", background: "rgba(20,50,15,0.4)", color: "#a0e040", fontWeight: 800, cursor: "pointer" },
  dangerBtn: { marginTop: 14, width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(200,80,80,0.25)", background: "rgba(200,50,50,0.12)", color: "rgba(240,130,130,0.95)", fontWeight: 900, cursor: "pointer" },

  subBox: { background: "rgba(20,50,15,0.35)", border: "1px solid rgba(100,180,60,0.12)", borderRadius: 12, padding: 12, marginTop: 12 },
  subBoxTitle: { fontSize: 12, fontWeight: 800, color: "#d8f0b0", marginBottom: 8 },

  errorBox: { marginBottom: 10, padding: 10, borderRadius: 10, background: "rgba(200,50,50,0.12)", border: "1px solid rgba(200,80,80,0.2)", color: "#f08080", fontSize: 12 },
  successBox: { marginBottom: 10, padding: 10, borderRadius: 10, background: "rgba(60,140,20,0.12)", border: "1px solid rgba(120,200,50,0.2)", color: "#88cc44", fontSize: 12 },

  muted: { color: "rgba(160,210,100,0.55)", fontSize: 13, marginTop: 10 },
  textarea: { width: "100%", minHeight: 180, marginTop: 10, padding: "10px 12px", background: "rgba(20,50,15,0.6)", border: "1px solid rgba(80,150,40,0.25)", borderRadius: 10, color: "#d8f0b0", fontFamily: "monospace", fontSize: 12 },

  aiStatus: { display: "flex", gap: 10, alignItems: "center", padding: "10px 0" },
  statusDot: { width: 12, height: 12, borderRadius: 4, border: "1px solid rgba(100,180,60,0.2)" },
  aiStatusText: { fontSize: 13, color: "rgba(180,230,100,0.8)", fontWeight: 700 },
}

