import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await api.post("/auth/login", form)
      console.log("[LOGIN] Response:", res.data)
      console.log("[LOGIN] Token:", res.data.access_token)
      setAuth(res.data.user, res.data.access_token)
      console.log("[LOGIN] Token saved to localStorage")
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L8 7H4l4 3-1.5 5L12 12l5.5 3L16 10l4-3h-4L12 2z" fill="#e8ffd0"/>
              <rect x="10" y="17" width="4" height="5" rx="1" fill="#e8ffd0"/>
              <path d="M7 19h10" stroke="#e8ffd0" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>Pac-Bot</div>
            <div style={styles.logoSub}>SMART FARM OS</div>
          </div>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in to manage your fields and harvests.</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              placeholder="farmer@pacbot.io"
              style={styles.input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              style={styles.input}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div style={{ textAlign: "right", marginBottom: "16px" }}>
            <Link to="/forgot-password" style={styles.link}>Forgot password?</Link>
          </div>

          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading ? "Signing in..." : "Sign in to farm"}
          </button>
        </form>

        <p style={styles.switchText}>
          No account yet?{" "}
          <Link to="/signup" style={styles.link}>Create one</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0a1a0b 0%, #1a3a10 40%, #0d2a0e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    width: "420px",
    background: "rgba(8, 20, 8, 0.85)",
    border: "1px solid rgba(100, 180, 60, 0.2)",
    borderRadius: "24px",
    padding: "44px 40px 40px",
  },
  logo: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" },
  logoIcon: {
    width: "40px", height: "40px",
    background: "linear-gradient(135deg, #4a9a20 0%, #7cd040 100%)",
    borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: "22px", fontWeight: "600", color: "#d4f0a0" },
  logoSub: { fontSize: "11px", color: "rgba(150,220,80,0.5)", letterSpacing: "2px" },
  heading: { fontSize: "26px", fontWeight: "500", color: "#e8f5d0", marginBottom: "6px" },
  subtitle: { fontSize: "13px", color: "rgba(160,210,100,0.55)", marginBottom: "28px" },
  error: {
    background: "rgba(200,50,50,0.15)", border: "1px solid rgba(200,80,80,0.3)",
    borderRadius: "8px", padding: "10px 14px", color: "#f08080",
    fontSize: "13px", marginBottom: "16px",
  },
  formGroup: { marginBottom: "16px" },
  label: {
    display: "block", fontSize: "12px", fontWeight: "500",
    color: "rgba(180,230,100,0.7)", letterSpacing: "0.8px",
    textTransform: "uppercase", marginBottom: "6px",
  },
  input: {
    width: "100%", height: "46px",
    background: "rgba(20, 50, 15, 0.6)",
    border: "1px solid rgba(80, 150, 40, 0.25)",
    borderRadius: "10px", color: "#d8f0b0",
    fontSize: "14px", padding: "0 14px",
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  },
  btnPrimary: {
    width: "100%", height: "48px",
    background: "linear-gradient(135deg, #3a8a18 0%, #5db82e 100%)",
    border: "none", borderRadius: "12px",
    color: "#e8ffd0", fontSize: "15px", fontWeight: "500",
    cursor: "pointer", marginTop: "4px",
  },
  link: { color: "rgba(140,220,70,0.85)", textDecoration: "none", fontSize: "13px" },
  switchText: { textAlign: "center", fontSize: "13px", color: "rgba(150,210,80,0.45)", marginTop: "22px" },
}