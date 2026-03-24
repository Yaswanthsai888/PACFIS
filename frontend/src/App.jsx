import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import useAuthStore from "./store/authStore"
import AppLayout from "./components/layout/AppLayout"
import Login from "./pages/auth/Login"
import Signup from "./pages/auth/Signup"
import ForgotPassword from "./pages/auth/ForgotPassword"
import Dashboard from "./pages/dashboard/Dashboard"
import FieldSelection from "./pages/field/FieldSelection"
import Field3D from "./pages/field/Field3D"
import Crops from "./pages/crops/Crops"
import Bot from "./pages/bot/Bot"
import Yield from "./pages/yield/Yield"
import Profile from "./pages/profile/Profile"

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const ProtectedLayout = ({ children }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
)

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/fields" element={<ProtectedLayout><FieldSelection /></ProtectedLayout>} />
        <Route path="/crops" element={<ProtectedLayout><Crops /></ProtectedLayout>} />
        <Route path="/bot" element={<ProtectedLayout><Bot /></ProtectedLayout>} />
        <Route path="/yield" element={<ProtectedLayout><Yield /></ProtectedLayout>} />
        <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
        <Route path="/field/3d" element={<ProtectedRoute><Field3D /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App