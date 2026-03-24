import { useNavigate, useLocation, Link } from "react-router-dom"
import useAuthStore from "../../store/authStore"

export default function MainMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuthStore()

  if (!isAuthenticated) return null

  const onToggleFieldsView = () => {
    if (location.pathname.startsWith("/field/3d")) {
      navigate("/fields")
    } else {
      navigate("/field/3d")
    }
  }

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <div style={styles.brand}>Pac-Bot</div>
        <nav style={styles.nav}>
          <Link to="/dashboard" style={styles.link}>Dashboard</Link>
          <Link to="/fields" style={styles.link}>Fields</Link>
          <Link to="/crops" style={styles.link}>Crops</Link>
          <Link to="/bot" style={styles.link}>Bot</Link>
        </nav>
      </div>

      <div style={styles.right}>
        <button style={styles.toggleBtn} onClick={onToggleFieldsView}>Toggle Fields View</button>
        <button style={styles.logout} onClick={() => { logout(); navigate('/login') }}>Sign out</button>
      </div>
    </div>
  )
}

const styles = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'linear-gradient(90deg, #0b2b16 0%, #153b1f 100%)',
    color: '#e8ffd0',
    borderBottom: '1px solid rgba(100,180,60,0.12)',
  },
  left: { display: 'flex', alignItems: 'center', gap: '20px' },
  brand: { fontWeight: 700, fontSize: 16 },
  nav: { display: 'flex', gap: '12px', alignItems: 'center' },
  link: { color: 'rgba(220,255,190,0.9)', textDecoration: 'none', fontSize: 14 },
  right: { display: 'flex', gap: '8px', alignItems: 'center' },
  toggleBtn: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(100,180,60,0.12)',
    color: '#d8f0b0',
    borderRadius: 8,
    cursor: 'pointer'
  },
  logout: {
    padding: '8px 10px',
    background: 'transparent',
    border: '1px solid rgba(200,80,80,0.12)',
    color: '#ffd0d0',
    borderRadius: 8,
    cursor: 'pointer'
  }
}
