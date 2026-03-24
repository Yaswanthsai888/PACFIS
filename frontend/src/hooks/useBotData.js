import { useEffect, useRef, useState } from "react"

// This hook returns bot state.
// In demo mode it simulates the bot.
// When real bot connects, swap simulateBot() with WebSocket data.

const TASKS = ["Surveying", "Planting", "Watering", "Checking soil", "Returning to base"]

function generatePath(local) {
  if (!local || local.length < 3) return []
  const xs = local.map((p) => p.x)
  const zs = local.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const path = []
  const rowSpacing = 6
  let row = 0
  for (let z = minZ + 3; z < maxZ - 3; z += rowSpacing) {
    if (row % 2 === 0) {
      path.push({ x: minX + 3, z, row })
      path.push({ x: maxX - 3, z, row })
    } else {
      path.push({ x: maxX - 3, z, row })
      path.push({ x: minX + 3, z, row })
    }
    row++
  }
  return path
}

export default function useBotData(localCoords, mode = "demo") {
  const [botState, setBotState] = useState({
    position: { x: 0, z: 0 },
    battery: 92,
    speed: 0,
    task: "Initializing",
    taskIndex: 0,
    pathIndex: 0,
    completedRows: [],
    rowStatuses: {},
    timeOfDay: 8,
    isMoving: false,
  })

  const stateRef = useRef(botState)
  const pathRef = useRef([])
  const wsRef = useRef(null)

  useEffect(() => {
    if (!localCoords || localCoords.length < 3) return
    pathRef.current = generatePath(localCoords)
    if (pathRef.current.length > 0) {
      setBotState((s) => ({
        ...s,
        position: { x: pathRef.current[0].x, z: pathRef.current[0].z },
        isMoving: true,
        task: TASKS[1],
      }))
    }
  }, [localCoords])

  useEffect(() => {
    stateRef.current = botState
  }, [botState])

  // Demo mode simulation
  useEffect(() => {
    if (mode !== "demo") return

    // Bot movement along path
    let pathIdx = 0
    const moveInterval = setInterval(() => {
      const path = pathRef.current
      if (!path || path.length === 0) return
      pathIdx = (pathIdx + 1) % path.length
      const next = path[pathIdx]
      const prev = path[Math.max(0, pathIdx - 1)]
      const dx = next.x - prev.x
      const dz = next.z - prev.z
      const speed = Math.sqrt(dx * dx + dz * dz) * 0.4

      setBotState((s) => ({
        ...s,
        position: { x: next.x, z: next.z },
        speed: parseFloat(speed.toFixed(1)),
        task: TASKS[next.row % TASKS.length],
        pathIndex: pathIdx,
        battery: Math.max(20, s.battery - 0.02),
        completedRows: pathIdx > 0
          ? [...new Set([...s.completedRows, path[Math.max(0, pathIdx - 1)].row])]
          : s.completedRows,
        rowStatuses: {
          ...s.rowStatuses,
          [path[pathIdx].row]: ["healthy", "wet", "dry"][path[pathIdx].row % 3],
        },
      }))
    }, 800)

    // Time of day cycle
    const timeInterval = setInterval(() => {
      setBotState((s) => ({
        ...s,
        timeOfDay: s.timeOfDay >= 22 ? 5 : s.timeOfDay + 0.1,
      }))
    }, 200)

    // WebSocket hook (ready for real bot)
    if (mode === "ws") {
      wsRef.current = new WebSocket("ws://localhost:8000/ws/bot")
      wsRef.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setBotState((s) => ({ ...s, ...data }))
      }
    }

    return () => {
      clearInterval(moveInterval)
      clearInterval(timeInterval)
      wsRef.current?.close()
    }
  }, [mode, localCoords])

  return botState
}