import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import useAuthStore from "../../store/authStore"
import useNotificationStore from "../../store/notificationStore"
import { getNotifications, markNotificationRead, clearNotifications } from "../../services/notificationService"
import api from "../../services/api"
import useFieldStore from "../../store/fieldStore"

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "⊞" },
  { label: "Fields", path: "/fields", icon: "⬡" },
  { label: "Crops", path: "/crops", icon: "⚘" },
  { label: "Yield", path: "/yield", icon: "⟐" },
  { label: "3D View", path: "/field/3d", icon: "◈" },
  { label: "Bot", path: "/bot", icon: "⊙" },
  { label: "Profile", path: "/profile", icon: "☻" },
]

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { notifications, unreadCount, setNotifications, markRead, clearAll } = useNotificationStore()
  const { activeField } = useFieldStore()

  const [notifOpen, setNotifOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const seenIdsRef = useRef(new Set())
  const toastSeqRef = useRef(0)

  const pushToast = (n) => {
    toastSeqRef.current += 1
    const id = `t_${toastSeqRef.current}`
    setToasts((prev) => [...prev, { id, ...n }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }

  const refresh = async (withToasts) => {
    try {
      const res = await getNotifications()
      const list = res.data || []

      if (withToasts) {
        const newOnes = list.filter((n) => !seenIdsRef.current.has(n.id))
        newOnes.slice(0, 3).forEach((n) => pushToast(n))
      }

      const nextIds = new Set(list.map((n) => n.id))
      seenIdsRef.current = new Set([...seenIdsRef.current, ...nextIds])
      setNotifications(list)
    } catch (e) {
      // silent
    }
  }

  useEffect(() => {
    if (!user) return
    refresh(false)
    const t = window.setInterval(() => refresh(true), 12000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!notifOpen) return
    const onDoc = (e) => {
      if (!e.target.closest?.("[data-notif-root]")) setNotifOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [notifOpen])

  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (!chatOpen) return
    // Auto scroll to latest message.
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [chatOpen, chatMessages.length])

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatSending) return

    setChatInput("")
    const userMsg = { id: `m_${Date.now()}_${Math.random()}`, role: "user", text }
    setChatMessages((prev) => [...prev, userMsg])
    setChatSending(true)

    try {
      const res = await api.post("/ai/chat", {
        message: text,
        field_id: activeField?.id,
      })
      const reply = res.data?.reply || ""
      const botMsg = { id: `m_${Date.now()}_b_${Math.random()}`, role: "assistant", text: reply }
      setChatMessages((prev) => [...prev, botMsg])
    } catch (e) {
      const errMsg = { id: `m_${Date.now()}_e_${Math.random()}`, role: "assistant", text: "Connection error. Please try again." }
      setChatMessages((prev) => [...prev, errMsg])
    } finally {
      setChatSending(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Notifications overlay (top-right + toasts) */}
      <div style={styles.notifOverlay} data-notif-root>
        <button style={styles.bellBtn} onClick={() => setNotifOpen((s) => !s)} aria-label="Notifications">
          🔔
          {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
        </button>

        {notifOpen && (
          <div style={styles.notifDropdown}>
            <div style={styles.notifHeader}>
              <div style={styles.notifHeaderTitle}>Alerts</div>
              <button
                style={styles.clearBtn}
                onClick={async () => {
                  try {
                    await clearNotifications()
                    clearAll()
                    seenIdsRef.current = new Set()
                    setNotifOpen(false)
                  } catch (e) {
                    // ignore
                  }
                }}
              >
                Clear
              </button>
            </div>
            <div style={styles.notifList}>
              {notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  style={{ ...styles.notifItem, ...(n.read ? {} : styles.notifItemUnread) }}
                  onClick={async () => {
                    if (!n.read) {
                      try {
                        await markNotificationRead(n.id)
                      } catch (e) {
                        // ignore
                      }
                      markRead(n.id)
                    }
                    setNotifOpen(false)
                  }}
                  role="button"
                >
                  <div style={{ ...styles.notifTypeDot, ...typeDotStyle(n.type) }} />
                  <div style={styles.notifBody}>
                    <div style={styles.notifTitleRow}>
                      <span style={styles.notifTitle}>{n.title}</span>
                      {!n.read && <span style={styles.unreadPill}>New</span>}
                    </div>
                    <div style={styles.notifMsg}>{n.message}</div>
                    <div style={styles.notifTime}>
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <div style={styles.notifEmpty}>No notifications yet.</div>}
            </div>
          </div>
        )}
      </div>

      <div style={styles.toastWrap}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...styles.toast, ...toastStyle(t.type) }}>
            <div style={styles.toastTitle}>{t.title}</div>
            <div style={styles.toastMsg}>{t.message}</div>
          </div>
        ))}
      </div>

      {/* Chat widget bottom-right */}
      <div style={styles.chatOverlay}>
        {!chatOpen ? (
          <button
            style={styles.chatFab}
            onClick={() => {
              setChatOpen(true)
              if (chatMessages.length === 0) {
                setChatMessages([
                  {
                    id: `m_${Date.now()}_g`,
                    role: "assistant",
                    text: "Hi farmer. Ask me about your field, crops, water, or next bot tasks.",
                  },
                ])
              }
            }}
            aria-label="Open chat"
          >
            ✦
          </button>
        ) : (
          <div style={styles.chatPanel} role="dialog" aria-label="PAC-FIS chat">
            <div style={styles.chatHeader}>
              <div style={styles.chatHeaderTitle}>PAC-FIS Chat</div>
              <button style={styles.chatClose} onClick={() => setChatOpen(false)}>✕</button>
            </div>
            <div style={styles.chatMessages}>
              {chatMessages.length === 0 ? (
                <div style={styles.chatEmpty}>Ask PAC-FIS anything about your farm.</div>
              ) : (
                chatMessages.map((m) => (
                  <div key={m.id} style={{ ...styles.bubbleRow, ...(m.role === "user" ? styles.bubbleRowUser : styles.bubbleRowBot) }}>
                    <div style={{ ...styles.bubble, ...(m.role === "user" ? styles.bubbleUser : styles.bubbleBot) }}>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={styles.chatComposer}>
              <input
                style={styles.chatInput}
                value={chatInput}
                placeholder="Type your question..."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendChat()
                  }
                }}
              />
              <button
                style={styles.chatSend}
                disabled={chatSending || !chatInput.trim()}
                onClick={sendChat}
              >
                {chatSending ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.sidebar}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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

        <nav style={styles.nav}>
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
                onClick={() => navigate(item.path)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
                {active && <div style={styles.activePill} />}
              </button>
            )
          })}
        </nav>

        <div style={styles.footer}>
          <div style={styles.userRow}>
            <div style={{ ...styles.avatar, cursor: "pointer" }} onClick={() => navigate("/profile")} role="button" aria-label="Profile">
              {user?.first_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>
                {user?.first_name} {user?.last_name}
              </div>
              <div style={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div style={styles.main}>
        {children}
      </div>
    </div>
  )
}

function toastStyle(type) {
  if (type === "success") return { background: "rgba(60,140,20,0.16)", border: "1px solid rgba(120,200,60,0.35)" }
  if (type === "warning") return { background: "rgba(200,150,20,0.16)", border: "1px solid rgba(220,170,40,0.35)" }
  if (type === "error") return { background: "rgba(200,50,50,0.16)", border: "1px solid rgba(240,80,80,0.35)" }
  return { background: "rgba(80,120,220,0.14)", border: "1px solid rgba(120,160,240,0.35)" }
}

function typeDotStyle(type) {
  if (type === "success") return { background: "#6cc030" }
  if (type === "warning") return { background: "#ddaa44" }
  if (type === "error") return { background: "#cc3333" }
  return { background: "#66aaff" }
}

const styles = {
  container: {
    display: "flex", minHeight: "100vh",
    background: "#0d1a0e", fontFamily: "'DM Sans', sans-serif",
  },
  sidebar: {
    width: "220px", minWidth: "220px",
    background: "rgba(8,20,8,0.98)",
    borderRight: "1px solid rgba(100,180,60,0.12)",
    display: "flex", flexDirection: "column",
    position: "sticky", top: 0, height: "100vh",
  },
  logoWrap: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "22px 18px 18px",
    borderBottom: "1px solid rgba(100,180,60,0.08)",
  },
  logoIcon: {
    width: "34px", height: "34px",
    background: "linear-gradient(135deg, #4a9a20, #7cd040)",
    borderRadius: "10px", display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  logoText: { fontSize: "17px", fontWeight: "600", color: "#d4f0a0" },
  logoSub: { fontSize: "9px", color: "rgba(150,220,80,0.45)", letterSpacing: "1.5px" },
  nav: { flex: 1, padding: "10px 10px", overflowY: "auto" },
  navItem: {
    width: "100%", display: "flex", alignItems: "center",
    gap: "10px", padding: "9px 10px",
    background: "none", border: "none", borderRadius: "8px",
    color: "rgba(170,220,90,0.5)", fontSize: "13px",
    cursor: "pointer", marginBottom: "2px",
    textAlign: "left", position: "relative",
    transition: "background 0.15s, color 0.15s",
  },
  navItemActive: {
    background: "rgba(60,120,20,0.25)",
    color: "#a8e040",
    border: "0.5px solid rgba(100,180,50,0.2)",
  },
  navIcon: { fontSize: "15px", width: "18px", textAlign: "center", flexShrink: 0 },
  activePill: {
    position: "absolute", right: "8px", top: "50%",
    transform: "translateY(-50%)",
    width: "4px", height: "4px", borderRadius: "50%",
    background: "#7cd040",
  },
  footer: {
    padding: "14px", borderTop: "1px solid rgba(100,180,60,0.08)",
  },
  userRow: {
    display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px",
  },
  avatar: {
    width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
    background: "rgba(60,120,20,0.4)",
    border: "0.5px solid rgba(100,180,50,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#a0e040", fontSize: "12px", fontWeight: "600",
  },
  userInfo: { overflow: "hidden" },
  userName: {
    fontSize: "12px", fontWeight: "500", color: "#d8f0b0",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  userEmail: {
    fontSize: "10px", color: "rgba(150,210,80,0.4)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  logoutBtn: {
    width: "100%", padding: "7px",
    background: "rgba(200,50,50,0.08)",
    border: "0.5px solid rgba(200,80,80,0.18)",
    borderRadius: "7px", color: "rgba(240,130,130,0.65)",
    fontSize: "12px", cursor: "pointer",
  },
  main: { flex: 1, overflowY: "auto", minHeight: "100vh" },

  notifOverlay: {
    position: "fixed",
    top: 14,
    right: 18,
    zIndex: 1000,
  },
  bellBtn: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 10,
    border: "1px solid rgba(100,180,60,0.22)",
    background: "rgba(5,15,5,0.8)",
    color: "#e8f5d0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(200,50,50,0.25)",
    border: "1px solid rgba(240,130,130,0.4)",
    color: "#f08080",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
  },
  notifDropdown: {
    width: 360,
    marginTop: 10,
    background: "rgba(5,15,5,0.94)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(100,180,60,0.18)",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  },
  notifHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(100,180,60,0.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notifHeaderTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#a0e040",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  clearBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    background: "rgba(200,50,50,0.1)",
    border: "1px solid rgba(200,80,80,0.18)",
    color: "rgba(240,130,130,0.7)",
    fontSize: 12,
    cursor: "pointer",
  },
  notifList: { maxHeight: 340, overflowY: "auto" },
  notifItem: {
    padding: 12,
    display: "flex",
    gap: 10,
    borderBottom: "1px solid rgba(100,180,60,0.06)",
    cursor: "pointer",
  },
  notifItemUnread: {
    background: "rgba(120,200,50,0.08)",
  },
  notifTypeDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
    marginTop: 4,
  },
  notifBody: { flex: 1, minWidth: 0 },
  notifTitleRow: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" },
  notifTitle: { fontSize: 13, fontWeight: 600, color: "#d8f0b0" },
  unreadPill: {
    fontSize: 10,
    fontWeight: 700,
    color: "#f08080",
    background: "rgba(200,50,50,0.15)",
    border: "1px solid rgba(200,80,80,0.22)",
    padding: "2px 6px",
    borderRadius: 999,
    flexShrink: 0,
  },
  notifMsg: {
    fontSize: 12,
    color: "rgba(160,210,100,0.65)",
    marginTop: 6,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  notifTime: { fontSize: 10, color: "rgba(160,210,100,0.35)", marginTop: 6 },
  notifEmpty: { padding: 16, textAlign: "center", color: "rgba(160,210,100,0.5)", fontSize: 13 },

  toastWrap: {
    position: "fixed",
    bottom: 88,
    right: 18,
    zIndex: 1001,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  toast: {
    width: 320,
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    border: "1px solid rgba(100,180,60,0.18)",
  },
  toastTitle: { fontSize: 13, fontWeight: 700, color: "#e8f5d0", marginBottom: 6 },
  toastMsg: { fontSize: 12, color: "rgba(160,210,100,0.7)", lineHeight: 1.4 },

  chatOverlay: {
    position: "fixed",
    bottom: 18,
    right: 18,
    zIndex: 1002,
  },
  chatFab: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "linear-gradient(135deg, #3a8a18, #5db82e)",
    color: "#e8ffd0",
    border: "1px solid rgba(120,200,50,0.35)",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  },
  chatPanel: {
    width: 300,
    height: 400,
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(5,15,5,0.94)",
    border: "1px solid rgba(100,180,60,0.18)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(100,180,60,0.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatHeaderTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#a0e040",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  chatClose: {
    background: "none",
    border: "none",
    color: "rgba(160,210,100,0.7)",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  chatEmpty: {
    textAlign: "center",
    color: "rgba(160,210,100,0.5)",
    fontSize: 13,
    marginTop: 30,
  },
  bubbleRow: { display: "flex" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowBot: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.45,
    border: "1px solid rgba(100,180,60,0.12)",
  },
  bubbleUser: {
    background: "rgba(60,120,20,0.25)",
    color: "#e8ffd0",
    border: "1px solid rgba(120,200,50,0.25)",
  },
  bubbleBot: {
    background: "rgba(20,50,15,0.45)",
    color: "rgba(180,230,100,0.85)",
  },
  chatComposer: {
    padding: 12,
    borderTop: "1px solid rgba(100,180,60,0.1)",
    display: "flex",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    padding: "10px 12px",
    background: "rgba(20,50,15,0.6)",
    border: "1px solid rgba(80,150,40,0.25)",
    borderRadius: 10,
    color: "#d8f0b0",
    outline: "none",
    fontFamily: "inherit",
    fontSize: 13,
  },
  chatSend: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(120,200,50,0.35)",
    background: "linear-gradient(135deg, #3a8a18, #5db82e)",
    color: "#e8ffd0",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    minWidth: 70,
    opacity: 1,
  },
}