import { create } from "zustand"

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  isAuthenticated: !!localStorage.getItem("token"),

  setAuth: (user, token) => {
    console.log("[STORE] setAuth called with token:", token?.substring(0, 20) + "...")
    localStorage.setItem("token", token)
    console.log("[STORE] Token in localStorage:", localStorage.getItem("token")?.substring(0, 20) + "...")
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem("token")
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = "/login"
  },
}))

export default useAuthStore