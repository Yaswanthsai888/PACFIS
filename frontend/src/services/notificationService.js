import api from "./api"

export const getNotifications = () => api.get("/notifications/")
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`)
export const clearNotifications = () => api.delete("/notifications/clear")

