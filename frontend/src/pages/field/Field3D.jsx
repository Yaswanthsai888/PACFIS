import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import earcut from "earcut"
import useFieldStore from "../../store/fieldStore"
import { getFields } from "../../services/fieldService"
import useBotData from "../../hooks/useBotData"
import SoilAnalysisPanel from "../../components/ai/SoilAnalysisPanel"
import { getCropForField } from "../../services/cropService"
import { planTasks } from "../../services/aiService"
import api from "../../services/api"


function latLngToLocal(coords) {
  if (!coords || coords.length === 0) return []
  const cx = coords.reduce((s, c) => s + c.lng, 0) / coords.length
  const cy = coords.reduce((s, c) => s + c.lat, 0) / coords.length
  const scale = 111320
  return coords.map((c) => ({
    x: (c.lng - cx) * scale * Math.cos((cy * Math.PI) / 180),
    z: -(c.lat - cy) * scale,
  }))
}

function getTimeColor(hour) {
  if (hour < 6) return { sky: 0x020812, ambient: 0x111833, sunIntensity: 0.1, sunColor: 0x334466 }
  if (hour < 8) return { sky: 0x1a3a6e, ambient: 0x3366aa, sunIntensity: 0.8, sunColor: 0xffaa44 }
  if (hour < 17) return { sky: 0x0a2a4a, ambient: 0x88bbdd, sunIntensity: 1.8, sunColor: 0xfff4e0 }
  if (hour < 20) return { sky: 0x1a1a3a, ambient: 0xff7733, sunIntensity: 0.9, sunColor: 0xff6622 }
  return { sky: 0x020812, ambient: 0x111833, sunIntensity: 0.1, sunColor: 0x334466 }
}

const SOIL_COLORS = { healthy: 0x2d7a1f, wet: 0x1a5a8a, dry: 0xaa6622, default: 0x2d7a1f }
const GROWTH_COLORS = { none: null, seedling: 0x88dd44, growing: 0x44aa22, harvest: 0xddcc22 }

export default function Field3D() {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const navigate = useNavigate()
  const { fields, activeField, setFields, setActiveField } = useFieldStore()
  const [selectedField, setSelectedField] = useState(null)
  const [localCoords, setLocalCoords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRow, setSelectedRow] = useState(null)
  const [seeds, setSeeds] = useState([])
  const [showSoilPanel, setShowSoilPanel] = useState(false)
  const [fieldCrop, setFieldCrop] = useState(null)
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [soilAnalysis, setSoilAnalysis] = useState(null)
  const [taskPlan, setTaskPlan] = useState(null)
  const [taskPlanLoading, setTaskPlanLoading] = useState(false)
  const [taskPlanError, setTaskPlanError] = useState("")
  const [sentTasks, setSentTasks] = useState({})

  const botState = useBotData(localCoords, "demo")

  const handlePlanTasks = async () => {
    if (!selectedField) return
    if (!soilAnalysis) {
      setTaskPlanError("Run Soil Analysis first (Soil AI).")
      return
    }

    setTaskPlanLoading(true)
    setTaskPlanError("")
    try {
      const plan = await planTasks(selectedField, fieldCrop, soilAnalysis, botState)
      setTaskPlan(plan)
      setShowTaskPanel(true)
    } catch (e) {
      setTaskPlanError("Failed to plan tasks. Please try again.")
      setTaskPlan(null)
    } finally {
      setTaskPlanLoading(false)
    }
  }

  const handleSendToBot = async (qItem, idx) => {
    if (!selectedField) return
    try {
      const sentKey = qItem.order ?? qItem.task ?? qItem.task_name ?? idx
      const taskName = qItem.task || qItem.task_name || qItem.name || `Task ${qItem.order ?? ""}`.trim()

      const res = await api.post("/bot/tasks", {
        field_id: selectedField.id,
        task_name: taskName,
        description: qItem.description || null,
        priority: qItem.priority || "normal",
        estimated_minutes: qItem.estimated_minutes ?? null,
      })

      setSentTasks((s) => ({ ...s, [sentKey]: res.data?.id || true }))
    } catch (e) {
      // ignore
    }
  }

  const priorityColors = (priority) => {
    if (priority === "urgent") return { bg: "rgba(200,50,50,0.15)", border: "rgba(220,80,80,0.3)", text: "#f08080" }
    if (priority === "normal") return { bg: "rgba(200,150,20,0.15)", border: "rgba(220,170,40,0.3)", text: "#ddaa44" }
    return { bg: "rgba(60,140,20,0.15)", border: "rgba(80,160,40,0.3)", text: "#88cc44" }
  }

  // Load fields
  useEffect(() => {
    getFields().then((res) => {
      setFields(res.data)
      if (res.data.length > 0) {
        const f = activeField || res.data[0]
        setActiveField(f)
        setSelectedField(f)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
  if (!selectedField) return
  getCropForField(selectedField.id)
    .then(res => setFieldCrop(res.data))
    .catch(() => setFieldCrop(null))
}, [selectedField])

  useEffect(() => {
    setSoilAnalysis(null)
    setTaskPlan(null)
    setShowTaskPanel(false)
    setTaskPlanError("")
    setSentTasks({})
  }, [selectedField?.id])

  // Convert coords when field changes
  useEffect(() => {
    if (selectedField?.coordinates) {
      setLocalCoords(latLngToLocal(selectedField.coordinates))
    }
  }, [selectedField])

  // Build Three.js scene
  useEffect(() => {
    if (!localCoords || localCoords.length < 3 || !canvasRef.current) return

    const canvas = canvasRef.current
    const W = canvas.clientWidth, H = canvas.clientHeight

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a2a4a)
    scene.fog = new THREE.FogExp2(0x0a2a4a, 0.006)

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000)
    camera.position.set(0, 100, 140)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 20
    controls.maxDistance = 500
    controls.maxPolarAngle = Math.PI / 2.05

    // Lights
    const ambient = new THREE.AmbientLight(0x88bbdd, 0.6)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.8)
    sun.position.set(80, 120, 60)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -200
    sun.shadow.camera.right = 200
    sun.shadow.camera.top = 200
    sun.shadow.camera.bottom = -200
    scene.add(sun)
    scene.add(new THREE.AmbientLight(0x334466, 0.3))

    // Ground
    const groundGeo = new THREE.PlaneGeometry(1000, 1000)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1a3a0a })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.2
    ground.receiveShadow = true
    scene.add(ground)

    // Field surface triangulation
    const xs = localCoords.map((p) => p.x)
    const zs = localCoords.map((p) => p.z)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minZ = Math.min(...zs), maxZ = Math.max(...zs)

    const pts2d = localCoords.flatMap((p) => [p.x, p.z])
    const indices = earcut(pts2d)
    const fieldGeo = new THREE.BufferGeometry()
    const verts = []
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i]
      verts.push(localCoords[idx].x, 0, localCoords[idx].z)
    }
    fieldGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
    fieldGeo.computeVertexNormals()
    const fieldMat = new THREE.MeshLambertMaterial({ color: 0x2d7a1f, side: THREE.DoubleSide })
    const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat)
    fieldMesh.receiveShadow = true
    fieldMesh.name = "fieldSurface"
    scene.add(fieldMesh)

    // Boundary
    const boundaryPts = localCoords.map((p) => new THREE.Vector3(p.x, 0.4, p.z))
    boundaryPts.push(boundaryPts[0])
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPts)
    scene.add(new THREE.Line(boundaryGeo, new THREE.LineBasicMaterial({ color: 0x7cd040, linewidth: 2 })))

    // Corner posts
    localCoords.forEach((p) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 4, 8),
        new THREE.MeshLambertMaterial({ color: 0x7cd040 })
      )
      post.position.set(p.x, 2, p.z)
      post.castShadow = true
      scene.add(post)
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xaaff44 })
      )
      top.position.set(p.x, 4.3, p.z)
      scene.add(top)
    })

    // Point-in-polygon check
    function pointInPolygon(px, pz, polygon) {
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, zi = polygon[i].z
        const xj = polygon[j].x, zj = polygon[j].z
        if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
          inside = !inside
        }
      }
      return inside
    }

    // Row planes clipped to polygon
    const rowMeshes = {}
    const rowSpacing = 6
    let rowIdx = 0
    for (let z = minZ + 3; z < maxZ - 3; z += rowSpacing) {
      // Find x extents of this row within the polygon
      const samples = []
      for (let px = minX; px <= maxX; px += 0.5) {
        if (pointInPolygon(px, z, localCoords)) samples.push(px)
      }
      if (samples.length < 2) { rowIdx++; continue }
      const rowMinX = Math.min(...samples)
      const rowMaxX = Math.max(...samples)
      const rowW = rowMaxX - rowMinX

      const rowGeo = new THREE.PlaneGeometry(rowW, rowSpacing - 0.5)
      const rowMat = new THREE.MeshLambertMaterial({
        color: SOIL_COLORS.default, transparent: true, opacity: 0.6,
      })
      const rowMesh = new THREE.Mesh(rowGeo, rowMat)
      rowMesh.rotation.x = -Math.PI / 2
      rowMesh.position.set(rowMinX + rowW / 2, 0.1, z)
      rowMesh.name = `row_${rowIdx}`
      rowMesh.userData = { rowIndex: rowIdx, z }
      rowMesh.receiveShadow = true
      scene.add(rowMesh)
      rowMeshes[rowIdx] = rowMesh
      rowIdx++
    }

    // Grid lines clipped to polygon
    const gridMat = new THREE.LineBasicMaterial({ color: 0x3d9922, transparent: true, opacity: 0.35 })

    // Horizontal lines
    for (let z = minZ; z <= maxZ; z += rowSpacing) {
      const samples = []
      for (let px = minX; px <= maxX; px += 0.5) {
        if (pointInPolygon(px, z, localCoords)) samples.push(px)
      }
      if (samples.length < 2) continue
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.min(...samples), 0.2, z),
        new THREE.Vector3(Math.max(...samples), 0.2, z),
      ])
      scene.add(new THREE.Line(g, gridMat))
    }

    // Vertical lines
    for (let x = minX; x <= maxX; x += rowSpacing) {
      const samples = []
      for (let pz = minZ; pz <= maxZ; pz += 0.5) {
        if (pointInPolygon(x, pz, localCoords)) samples.push(pz)
      }
      if (samples.length < 2) continue
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.2, Math.min(...samples)),
        new THREE.Vector3(x, 0.2, Math.max(...samples)),
      ])
      scene.add(new THREE.Line(g, gridMat))
    }

    // Bot mesh group
    const botGroup = new THREE.Group()
    botGroup.name = "bot"

    const botBody = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 5),
      new THREE.MeshLambertMaterial({ color: 0xd4a020 })
    )
    botBody.position.y = 2
    botBody.castShadow = true
    botGroup.add(botBody)

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 2.5),
      new THREE.MeshLambertMaterial({ color: 0xe8b830 })
    )
    cabin.position.set(0, 3.75, -0.5)
    botGroup.add(cabin)

    // Headlight
    const headlight = new THREE.PointLight(0xffffaa, 1.5, 20)
    headlight.position.set(0, 3, 3)
    botGroup.add(headlight)

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(1, 1, 0.8, 16)
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 })
    ;[[-2.2, 1, 1.8], [2.2, 1, 1.8], [-2.2, 1, -1.8], [2.2, 1, -1.8]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.rotation.z = Math.PI / 2
      w.position.set(wx, wy, wz)
      w.castShadow = true
      botGroup.add(w)
    })

    // Bot indicator ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5, 5.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.1
    ring.name = "ring"
    botGroup.add(ring)

    const cx = localCoords.reduce((s, p) => s + p.x, 0) / localCoords.length
    const cz2 = localCoords.reduce((s, p) => s + p.z, 0) / localCoords.length
    botGroup.position.set(cx, 0, cz2)
    scene.add(botGroup)

    // Growth objects container
    const growthObjects = {}

    // Stars
    const starVerts = []
    for (let i = 0; i < 1000; i++) {
      starVerts.push(
        (Math.random() - 0.5) * 1200,
        Math.random() * 400 + 80,
        (Math.random() - 0.5) * 1200
      )
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0 }))
    stars.name = "stars"
    scene.add(stars)

    // Compass
    const compX = maxX + 14, compZ = minZ
    const compN = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xff3333 })
    )
    compN.rotation.x = Math.PI / 2
    compN.position.set(compX, 0.5, compZ - 4)
    scene.add(compN)
    const compS = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    compS.rotation.x = -Math.PI / 2
    compS.position.set(compX, 0.5, compZ + 4)
    scene.add(compS)

    // Raycaster for row clicking
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const onMouseClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const rowMeshList = Object.values(rowMeshes)
      const hits = raycaster.intersectObjects(rowMeshList)
      if (hits.length > 0) {
        const hit = hits[0].object
        setSelectedRow(hit.userData)
      }
    }
    canvas.addEventListener("click", onMouseClick)

    sceneRef.current = {
      renderer, scene, camera, controls,
      sun, ambient, botGroup, rowMeshes, growthObjects, stars,
    }

    // Animation loop
    let t = 0
    let frame
    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.02
      controls.update()

      // Pulse ring
      const r = botGroup.getObjectByName("ring")
      if (r) {
        r.material.opacity = 0.4 + 0.3 * Math.sin(t * 2)
        r.scale.set(1 + 0.05 * Math.sin(t), 1, 1 + 0.05 * Math.sin(t))
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener("click", onMouseClick)
      window.removeEventListener("resize", handleResize)
      renderer.dispose()
      sceneRef.current = null
    }
  }, [localCoords])

  // Sync bot position and state to scene
  useEffect(() => {
    if (!sceneRef.current) return
    const { botGroup, rowMeshes, growthObjects, scene, sun, ambient, stars } = sceneRef.current

    // Move bot
    botGroup.position.x += (botState.position.x - botGroup.position.x) * 0.08
    botGroup.position.z += (botState.position.z - botGroup.position.z) * 0.08

    // Face direction of movement
    const dx = botState.position.x - botGroup.position.x
    const dz = botState.position.z - botGroup.position.z
    if (Math.abs(dx) + Math.abs(dz) > 0.1) {
      botGroup.rotation.y = Math.atan2(dx, dz)
    }

    // Update soil colors
    Object.entries(botState.rowStatuses).forEach(([rowIdx, status]) => {
      const mesh = rowMeshes[parseInt(rowIdx)]
      if (mesh) mesh.material.color.set(SOIL_COLORS[status] || SOIL_COLORS.default)
    })

    // Growth stage per completed row
    botState.completedRows.forEach((rowIdx) => {
      const mesh = rowMeshes[rowIdx]
      if (!mesh) return
      const age = botState.completedRows.indexOf(rowIdx)
      const stage = age < 2 ? "seedling" : age < 5 ? "growing" : "harvest"
      const color = GROWTH_COLORS[stage]
      if (color) mesh.material.color.set(color)

      // Add crop geometry if not already there
      if (!growthObjects[rowIdx] && mesh) {
        const groupGeo = new THREE.Group()
        const count = 6
        const spacing = (mesh.geometry.parameters?.width || 20) / count
        for (let i = 0; i < count; i++) {
          const h = stage === "seedling" ? 1 : stage === "growing" ? 2.5 : 1.5
          const cropGeo = new THREE.CylinderGeometry(0.2, 0.3, h, 5)
          const cropMat = new THREE.MeshLambertMaterial({
            color: stage === "harvest" ? 0xddcc22 : 0x44aa22
          })
          const crop = new THREE.Mesh(cropGeo, cropMat)
          crop.position.set(
            mesh.position.x - (mesh.geometry.parameters?.width || 20) / 2 + i * spacing + spacing / 2,
            h / 2,
            mesh.position.z
          )
          crop.castShadow = true
          groupGeo.add(crop)
        }
        scene.add(groupGeo)
        growthObjects[rowIdx] = groupGeo
      }
    })

    // Planting seed effect — add tiny sphere briefly
    if (botState.isMoving && Math.random() < 0.15) {
      const seedGeo = new THREE.SphereGeometry(0.3, 6, 6)
      const seedMat = new THREE.MeshLambertMaterial({ color: 0xcc9933 })
      const seed = new THREE.Mesh(seedGeo, seedMat)
      seed.position.set(
        botGroup.position.x + (Math.random() - 0.5) * 3,
        0.5,
        botGroup.position.z + (Math.random() - 0.5) * 3
      )
      scene.add(seed)
      setSeeds((prev) => [...prev.slice(-20), { mesh: seed, age: 0 }])
    }

    // Time of day lighting
    const tc = getTimeColor(botState.timeOfDay)
    scene.background.set(tc.sky)
    scene.fog.color.set(tc.sky)
    ambient.color.set(tc.ambient)
    sun.intensity = tc.sunIntensity
    sun.color.set(tc.sunColor)
    const progress = (botState.timeOfDay - 5) / 17
    sun.position.set(
      Math.cos(progress * Math.PI) * 120,
      Math.sin(progress * Math.PI) * 120,
      60
    )
    stars.material.opacity = botState.timeOfDay < 7 || botState.timeOfDay > 19 ? 0.7 : 0

  }, [botState])

  // Fade out seeds
  useEffect(() => {
    const interval = setInterval(() => {
      setSeeds((prev) => prev.filter((s) => {
        s.age += 1
        s.mesh.position.y -= 0.05
        s.mesh.material.opacity = Math.max(0, 1 - s.age / 20)
        s.mesh.material.transparent = true
        if (s.age > 20) {
          sceneRef.current?.scene.remove(s.mesh)
          return false
        }
        return true
      }))
    }, 80)
    return () => clearInterval(interval)
  }, [])

  const batteryColor = botState.battery > 50 ? "#6cc030" : botState.battery > 20 ? "#ddaa20" : "#cc3333"
  const timeStr = `${Math.floor(botState.timeOfDay).toString().padStart(2, "0")}:${Math.floor((botState.timeOfDay % 1) * 60).toString().padStart(2, "0")}`

  return (
    <div style={styles.container}>
      {/* Top status bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/fields")}>← Map</button>
          <div style={styles.logoWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L8 7H4l4 3-1.5 5L12 12l5.5 3L16 10l4-3h-4L12 2z" fill="#e8ffd0"/>
            </svg>
            <span style={styles.logoText}>Pac-Bot</span>
          </div>
          <span style={styles.divider}>|</span>
          <span style={styles.pageLabel}>3D Field</span>
        </div>

        <div style={styles.statusItems}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Task</span>
            <span style={styles.statusVal}>{botState.task}</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Speed</span>
            <span style={styles.statusVal}>{botState.speed} m/s</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Battery</span>
            <span style={{ ...styles.statusVal, color: batteryColor }}>
              {Math.floor(botState.battery)}%
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Time</span>
            <span style={styles.statusVal}>{timeStr}</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Rows done</span>
            <span style={styles.statusVal}>{botState.completedRows.length}</span>
          </div>
          <div style={{ ...styles.statusItem, borderLeft: "1px solid rgba(100,180,60,0.2)", paddingLeft: "12px" }}>
            <span style={{ ...styles.statusLabel, color: "#44cc44" }}>● DEMO</span>
          </div>
          {/* Soil AI toggle */}
          <div style={{ marginLeft: 8, display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              style={{
                padding: "5px 12px",
                background: showSoilPanel ? "rgba(40,100,15,0.5)" : "rgba(20,50,10,0.4)",
                border: `1px solid ${showSoilPanel ? "rgba(100,200,50,0.4)" : "rgba(80,150,40,0.2)"}`,
                borderRadius: "6px", color: "#a0e040",
                fontSize: "12px", cursor: "pointer",
              }}
              onClick={() => setShowSoilPanel(!showSoilPanel)}
            >
              ✦ Soil AI
            </button>

            <button
              style={{
                padding: "5px 12px",
                background: "linear-gradient(135deg, #3a3a8a, #6644cc)",
                border: "1px solid rgba(120,80,220,0.4)",
                borderRadius: "6px",
                color: "#ddd0ff",
                fontSize: "12px",
                cursor: taskPlanLoading ? "not-allowed" : "pointer",
                opacity: taskPlanLoading ? 0.8 : 1,
              }}
              disabled={taskPlanLoading || !selectedField}
              onClick={handlePlanTasks}
            >
              {taskPlanLoading ? "⏳ Planning..." : "✦ Plan Tasks"}
            </button>

            {showSoilPanel && selectedField && (
              <SoilAnalysisPanel
                field={selectedField}
                crop={fieldCrop}
                soilZones={botState.rowStatuses}
                onClose={() => setShowSoilPanel(false)}
                onAnalysisComplete={(analysis) => setSoilAnalysis(analysis)}
              />
            )}
          </div>
        </div>

        {/* Field tabs */}
        <div style={styles.fieldTabs}>
          {fields.map((f) => (
            <button
              key={f.id}
              style={{ ...styles.tabBtn, ...(selectedField?.id === f.id ? styles.tabBtnActive : {}) }}
              onClick={() => { setSelectedField(f); setActiveField(f) }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {showTaskPanel && selectedField && (
        <div style={styles.taskPanel}>
          <div style={styles.taskPanelHeader}>
            <div style={styles.taskPanelTitle}>PAC-FIS Task Planner</div>
            <button style={styles.taskPanelClose} onClick={() => setShowTaskPanel(false)}>✕</button>
          </div>

          {taskPlanError && <div style={styles.taskError}>{taskPlanError}</div>}

          {!taskPlan && !taskPlanLoading && (
            <div style={styles.taskEmpty}>
              Click <b>Plan Tasks</b> to generate the bot queue.
            </div>
          )}

          {taskPlanLoading && (
            <div style={styles.taskLoading}>⏳ Planning tasks...</div>
          )}

          {taskPlan && (
            <div style={styles.taskContent}>
              <div style={styles.taskSectionTitle}>Current task</div>
              <div style={styles.currentTask}>{taskPlan.current_task || taskPlan.currentTask || "—"}</div>

              {taskPlan.reasoning && (
                <div style={styles.taskReason}>
                  <div style={styles.taskSubTitle}>Reasoning</div>
                  {taskPlan.reasoning}
                </div>
              )}

              <div style={{ ...styles.taskSectionTitle, marginTop: 14 }}>Task queue</div>
              <div style={styles.queueList}>
                {(taskPlan.task_queue || []).map((q, i) => {
                  const sentKey = q.order ?? q.task ?? q.task_name ?? i
                  const colors = priorityColors(q.priority)
                  return (
                    <div key={sentKey} style={styles.queueItem}>
                      <div
                        style={{
                          ...styles.queueBadge,
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          color: colors.text,
                        }}
                      >
                        {(q.priority || "low").toUpperCase()}
                      </div>
                      <div style={styles.queueMain}>
                        <div style={styles.queueName}>
                          {q.task || q.task_name || q.name || `Task ${q.order ?? i + 1}`}
                        </div>
                        {q.description && <div style={styles.queueDesc}>{q.description}</div>}
                        <div style={styles.queueMeta}>
                          Est: {q.estimated_minutes ?? "—"} min
                        </div>
                      </div>
                      <button
                        style={{ ...styles.sendBtn, ...(sentTasks[sentKey] ? styles.sendBtnSent : {}) }}
                        disabled={!!sentTasks[sentKey]}
                        onClick={() => handleSendToBot(q, i)}
                      >
                        {sentTasks[sentKey] ? "Sent" : "Send to Bot"}
                      </button>
                    </div>
                  )
                })}
                {(!taskPlan.task_queue || taskPlan.task_queue.length === 0) && (
                  <div style={styles.taskEmptyList}>No tasks returned.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Side panel */}
      <div style={styles.sidePanel}>
        <div style={styles.panelTitle}>Field Info</div>
        {selectedField && (
          <>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Name</span>
              <span style={styles.panelVal}>{selectedField.name}</span>
            </div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Area</span>
              <span style={styles.panelVal}>
                {selectedField.area_sqm ? `${(selectedField.area_sqm / 10000).toFixed(2)} ha` : "—"}
              </span>
            </div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Boundary pts</span>
              <span style={styles.panelVal}>{selectedField.coordinates.length}</span>
            </div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Crop</span>
              <span style={styles.panelVal}>Unassigned</span>
            </div>
          </>
        )}

        <div style={{ ...styles.panelTitle, marginTop: "16px" }}>Soil Legend</div>
        {[["healthy", "#2d7a1f", "Healthy"], ["wet", "#1a5a8a", "Wet"], ["dry", "#aa6622", "Dry"]].map(([k, c, l]) => (
          <div key={k} style={styles.legendRow}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: c }} />
            <span style={styles.panelLabel}>{l}</span>
          </div>
        ))}

        <div style={{ ...styles.panelTitle, marginTop: "16px" }}>Growth Legend</div>
        {[["#88dd44", "Seedling"], ["#44aa22", "Growing"], ["#ddcc22", "Harvest"]].map(([c, l]) => (
          <div key={l} style={styles.legendRow}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: c }} />
            <span style={styles.panelLabel}>{l}</span>
          </div>
        ))}

        {selectedRow && (
          <>
            <div style={{ ...styles.panelTitle, marginTop: "16px" }}>Selected Row</div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Row #</span>
              <span style={styles.panelVal}>{selectedRow.rowIndex}</span>
            </div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Soil</span>
              <span style={styles.panelVal}>
                {botState.rowStatuses[selectedRow.rowIndex] || "Unvisited"}
              </span>
            </div>
            <div style={styles.panelRow}>
              <span style={styles.panelLabel}>Status</span>
              <span style={styles.panelVal}>
                {botState.completedRows.includes(selectedRow.rowIndex) ? "Planted" : "Pending"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Hints */}
      <div style={styles.hints}>
        <span>🖱 Drag to rotate</span>
        <span>⚲ Scroll to zoom</span>
        <span>Click row to inspect</span>
      </div>

      {!loading && fields.length === 0 && (
        <div style={styles.emptyOverlay}>
          <div style={styles.emptyCard}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⬡</div>
            <div style={styles.emptyTitle}>No fields registered</div>
            <div style={styles.emptySub}>Draw a field boundary first</div>
            <button style={styles.goBtn} onClick={() => navigate("/fields")}>Go to Map</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { width: "100vw", height: "100vh", background: "#0a1a0e", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    background: "rgba(5,15,5,0.9)", backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(100,180,60,0.2)",
    padding: "8px 16px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
  },
  topLeft: { display: "flex", alignItems: "center", gap: "10px" },
  backBtn: { background: "none", border: "1px solid rgba(100,180,60,0.3)", borderRadius: "6px", color: "rgba(160,220,80,0.8)", fontSize: "12px", padding: "4px 10px", cursor: "pointer" },
  logoWrap: { display: "flex", alignItems: "center", gap: "6px" },
  logoText: { fontSize: "15px", fontWeight: "600", color: "#d4f0a0" },
  divider: { color: "rgba(100,180,60,0.3)", fontSize: "16px" },
  pageLabel: { fontSize: "12px", color: "rgba(160,210,100,0.5)" },
  statusItems: { display: "flex", gap: "16px", alignItems: "center" },
  statusItem: { display: "flex", flexDirection: "column", alignItems: "center" },
  statusLabel: { fontSize: "9px", color: "rgba(150,210,80,0.45)", textTransform: "uppercase", letterSpacing: "0.8px" },
  statusVal: { fontSize: "12px", fontWeight: "500", color: "#d8f0b0" },
  fieldTabs: { display: "flex", gap: "6px", marginLeft: "auto" },
  tabBtn: { padding: "4px 10px", background: "rgba(20,50,15,0.6)", border: "1px solid rgba(80,150,40,0.2)", borderRadius: "6px", color: "rgba(180,230,100,0.6)", fontSize: "11px", cursor: "pointer" },
  tabBtnActive: { background: "rgba(60,130,20,0.4)", border: "1px solid rgba(120,200,50,0.5)", color: "#a0e040" },
  canvas: { width: "100%", height: "100%", display: "block" },
  sidePanel: {
    position: "absolute", right: "16px", top: "70px",
    width: "180px", background: "rgba(5,15,5,0.85)",
    backdropFilter: "blur(8px)", border: "1px solid rgba(100,180,60,0.15)",
    borderRadius: "12px", padding: "14px", zIndex: 10,
  },
  panelTitle: { fontSize: "10px", fontWeight: "500", color: "rgba(160,220,80,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" },
  panelRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  panelLabel: { fontSize: "11px", color: "rgba(150,200,80,0.5)" },
  panelVal: { fontSize: "11px", color: "#d8f0b0", fontWeight: "500" },
  legendRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" },
  hints: {
    position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)",
    display: "flex", gap: "16px", background: "rgba(5,15,5,0.7)",
    border: "1px solid rgba(100,180,60,0.15)", borderRadius: "8px",
    padding: "6px 16px", color: "rgba(160,210,80,0.45)", fontSize: "11px", zIndex: 10,
  },
  emptyOverlay: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,15,5,0.8)", zIndex: 20 },
  emptyCard: { background: "rgba(15,35,10,0.95)", border: "1px solid rgba(100,180,60,0.2)", borderRadius: "16px", padding: "40px", textAlign: "center" },
  emptyTitle: { fontSize: "18px", fontWeight: "500", color: "#e8f5d0", marginBottom: "8px" },
  emptySub: { fontSize: "13px", color: "rgba(160,210,100,0.5)", marginBottom: "20px" },
  goBtn: { padding: "10px 24px", background: "linear-gradient(135deg, #3a8a18, #5db82e)", border: "none", borderRadius: "8px", color: "#e8ffd0", fontSize: "14px", cursor: "pointer" },

  taskPanel: {
    position: "absolute",
    right: "16px",
    top: "70px",
    bottom: "60px",
    width: "320px",
    background: "rgba(5,14,5,0.94)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(100,180,60,0.18)",
    borderRadius: "14px",
    zIndex: 20,
    padding: "14px",
    overflowY: "auto",
    fontFamily: "'DM Sans', sans-serif",
  },
  taskPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "10px",
    borderBottom: "0.5px solid rgba(100,180,60,0.1)",
    marginBottom: "10px",
  },
  taskPanelTitle: { fontSize: "13px", fontWeight: "600", color: "#ddd0ff" },
  taskPanelClose: {
    background: "none",
    border: "none",
    color: "rgba(160,210,100,0.5)",
    cursor: "pointer",
    fontSize: "14px",
  },
  taskError: {
    background: "rgba(200,50,50,0.12)",
    border: "1px solid rgba(200,80,80,0.25)",
    borderRadius: "8px",
    padding: "10px",
    color: "#f08080",
    fontSize: "12px",
    marginBottom: "10px",
  },
  taskEmpty: { color: "rgba(160,210,100,0.5)", fontSize: "13px", padding: "18px 0", textAlign: "center" },
  taskLoading: { color: "rgba(160,210,100,0.7)", fontSize: "13px", padding: "18px 0", textAlign: "center" },
  taskContent: {},
  taskSectionTitle: {
    fontSize: "10px",
    fontWeight: "600",
    color: "rgba(160,220,80,0.6)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "8px",
  },
  currentTask: {
    background: "rgba(20,50,15,0.5)",
    border: "1px solid rgba(100,180,60,0.15)",
    borderRadius: "12px",
    padding: "10px 12px",
    color: "#e8ffd0",
    fontSize: "13px",
    marginBottom: "10px",
  },
  taskReason: {
    marginBottom: "12px",
    background: "rgba(20,15,40,0.35)",
    border: "1px solid rgba(120,80,220,0.2)",
    borderRadius: "12px",
    padding: "10px 12px",
  },
  taskSubTitle: { fontSize: "11px", fontWeight: "600", color: "#bb99ff", marginBottom: "6px" },
  queueList: { display: "flex", flexDirection: "column", gap: 10 },
  queueItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 10px",
    background: "rgba(12,28,10,0.85)",
    border: "1px solid rgba(80,150,40,0.15)",
    borderRadius: "12px",
  },
  queueBadge: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.6px",
    borderRadius: "999px",
    padding: "4px 8px",
    color: "#e8ffd0",
    flexShrink: 0,
  },
  queueMain: { flex: 1, minWidth: 0 },
  queueName: { fontSize: "13px", fontWeight: "700", color: "#d8f0b0", marginBottom: 4, lineHeight: 1.2 },
  queueDesc: { fontSize: "12px", color: "rgba(160,210,100,0.65)", lineHeight: 1.4, marginBottom: 6 },
  queueMeta: { fontSize: "11px", color: "rgba(160,210,100,0.55)" },
  sendBtn: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(120,200,50,0.35)",
    background: "linear-gradient(135deg, #3a8a18, #5db82e)",
    color: "#e8ffd0",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
    alignSelf: "stretch",
    minWidth: 92,
  },
  sendBtnSent: {
    background: "rgba(80,150,40,0.15)",
    border: "1px solid rgba(100,180,60,0.25)",
    color: "rgba(210,255,170,0.75)",
    cursor: "default",
  },
  taskEmptyList: { textAlign: "center", color: "rgba(160,210,100,0.55)", fontSize: "13px", padding: "12px 0" },
}
