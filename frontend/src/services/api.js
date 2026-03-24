import axios from "axios"
import { API_BASE_URL } from "../lib/config"

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    console.log("[API] Token added to request:", token.substring(0, 20) + "...")
  } else {
    console.log("[API] No token found in localStorage")
  }
  return config
}, (error) => Promise.reject(error))

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[API] Response error:", err.response?.status, err.response?.data)
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export default api