import { create } from "zustand"

const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications: notifications || [],
      unreadCount: (notifications || []).filter((n) => !n.read).length,
    }),

  addNotification: (notification) =>
    set((s) => {
      const next = notification ? [notification, ...s.notifications] : s.notifications
      return {
        notifications: next,
        unreadCount: next.filter((n) => !n.read).length,
      }
    }),

  removeNotification: (id) =>
    set((s) => {
      const next = s.notifications.filter((n) => n.id !== id)
      return {
        notifications: next,
        unreadCount: next.filter((n) => !n.read).length,
      }
    }),

  clearAll: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),

  markRead: (id) =>
    set((s) => {
      const next = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      return {
        notifications: next,
        unreadCount: next.filter((n) => !n.read).length,
      }
    }),
}))

export default useNotificationStore

