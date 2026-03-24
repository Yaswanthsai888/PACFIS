import { useEffect, useState } from "react"

const defaultBotState = {
  position: { x: 0, z: 0 },
  battery: 0,
  speed: 0,
  task: "Awaiting connection",
  completedRows: [],
  rowStatuses: {},
  timeOfDay: 8,
  isMoving: false,
}

export default function useBotWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState("offline") // offline | online
  const [botState, setBotState] = useState(defaultBotState)

  useEffect(() => {
    let ws
    try {
      ws = new WebSocket("ws://localhost:8000/ws/bot")
    } catch {
      setConnectionStatus("offline")
      return
    }

    ws.onopen = () => setConnectionStatus("online")
    ws.onclose = () => setConnectionStatus("offline")
    ws.onerror = () => setConnectionStatus("offline")

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setBotState((s) => ({ ...s, ...data }))
      } catch {
        // ignore
      }
    }

    return () => {
      try {
        ws?.close()
      } catch {
        // ignore
      }
    }
  }, [])

  return { botState, connectionStatus }
}

