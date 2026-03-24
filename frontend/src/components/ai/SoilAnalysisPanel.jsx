import { useState } from "react"
import { analyzeSoil } from "../../services/aiService"

const PRIORITY_COLORS = {
  high: { bg: "rgba(200,50,50,0.15)", border: "rgba(220,80,80,0.3)", text: "#f08080" },
  medium: { bg: "rgba(200,150,20,0.15)", border: "rgba(220,170,40,0.3)", text: "#ddaa44" },
  low: { bg: "rgba(60,140,20,0.15)", border: "rgba(80,160,40,0.3)", text: "#88cc44" },
}

const SEVERITY_COLORS = {
  high: "#f08080",
  medium: "#ddaa44",
  low: "#88cc44",
}

function HealthRing({ score }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 70 ? "#6cc030" : score >= 40 ? "#ddaa20" : "#cc3333"
  return (
    <div style={{ position: "relative", width: "72px", height: "72px", flexShrink: 0 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "16px", fontWeight: "600", color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: "9px", color: "rgba(160,210,80,0.5)" }}>/100</div>
      </div>
    </div>
  )
}

export default function SoilAnalysisPanel({ field, crop, soilZones, onClose, onAnalysisComplete }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("overview")

  const totalZones = Object.keys(soilZones).length
  const healthyCount = Object.values(soilZones).filter(s => s === "healthy").length
  const wetCount = Object.values(soilZones).filter(s => s === "wet").length
  const dryCount = Object.values(soilZones).filter(s => s === "dry").length

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeSoil(field, crop, soilZones)
      if (result) {
        setAnalysis(result)
        onAnalysisComplete?.(result)
        setActiveTab("overview")
      } else {
        setError("Analysis failed. Try again.")
      }
    } catch (e) {
      setError("Connection error. Check your network.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>PAC-FIS Soil Analysis</div>
          <div style={styles.headerSub}>{field?.name || "Field"}</div>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Zone summary */}
      <div style={styles.zoneSummary}>
        <div style={styles.zoneItem}>
          <div style={{ ...styles.zoneDot, background: "#2d7a1f" }} />
          <span style={styles.zoneLabel}>Healthy</span>
          <span style={styles.zoneCount}>{healthyCount}</span>
        </div>
        <div style={styles.zoneItem}>
          <div style={{ ...styles.zoneDot, background: "#1a5a8a" }} />
          <span style={styles.zoneLabel}>Wet</span>
          <span style={styles.zoneCount}>{wetCount}</span>
        </div>
        <div style={styles.zoneItem}>
          <div style={{ ...styles.zoneDot, background: "#aa6622" }} />
          <span style={styles.zoneLabel}>Dry</span>
          <span style={styles.zoneCount}>{dryCount}</span>
        </div>
        <div style={styles.zoneItem}>
          <span style={styles.zoneLabel}>Total</span>
          <span style={styles.zoneCount}>{totalZones}</span>
        </div>
      </div>

      {/* Crop context */}
      {crop && (
        <div style={styles.cropChip}>
          <span style={styles.cropChipLabel}>Crop:</span>
          <span style={styles.cropChipVal}>{crop.crop_name}</span>
          <span style={styles.cropChipLabel}>pH:</span>
          <span style={styles.cropChipVal}>{crop.soil_ph_min}–{crop.soil_ph_max}</span>
        </div>
      )}

      {/* Run button */}
      {!analysis && (
        <button
          style={{ ...styles.analyzeBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? (
            <span style={styles.loadingWrap}>
              <span style={styles.spinner} />
              PAC-FIS analyzing...
            </span>
          ) : "Run Soil Analysis ✦"}
        </button>
      )}

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Analysis results */}
      {analysis && (
        <>
          {/* Health score + summary */}
          <div style={styles.scoreRow}>
            <HealthRing score={analysis.health_score} />
            <div style={styles.scoreRight}>
              <div style={styles.healthLabel}>{analysis.health_label}</div>
              <div style={styles.summary}>{analysis.summary}</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            {["overview", "water", "risks", "bot"].map((tab) => (
              <button
                key={tab}
                style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "bot" ? "Bot tasks" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={styles.tabContent}>
            {activeTab === "overview" && (
              <div>
                {/* Zone advice */}
                {analysis.zones?.healthy_advice && (
                  <div style={styles.adviceRow}>
                    <div style={{ ...styles.adviceDot, background: "#2d7a1f" }} />
                    <div style={styles.adviceText}>{analysis.zones.healthy_advice}</div>
                  </div>
                )}
                {analysis.zones?.wet_advice && (
                  <div style={styles.adviceRow}>
                    <div style={{ ...styles.adviceDot, background: "#1a5a8a" }} />
                    <div style={styles.adviceText}>{analysis.zones.wet_advice}</div>
                  </div>
                )}
                {analysis.zones?.dry_advice && (
                  <div style={styles.adviceRow}>
                    <div style={{ ...styles.adviceDot, background: "#aa6622" }} />
                    <div style={styles.adviceText}>{analysis.zones.dry_advice}</div>
                  </div>
                )}

                {/* Recommendations */}
                <div style={styles.subTitle}>Recommendations</div>
                {analysis.recommendations?.map((rec, i) => {
                  const c = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low
                  return (
                    <div key={i} style={{ ...styles.recCard, background: c.bg, border: `0.5px solid ${c.border}` }}>
                      <div style={styles.recHeader}>
                        <span style={{ ...styles.recPriority, color: c.text }}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <span style={styles.recAction}>{rec.action}</span>
                      </div>
                      <div style={styles.recReason}>{rec.reason}</div>
                    </div>
                  )
                })}

                {/* Fertilizer */}
                {analysis.fertilizer?.needed && (
                  <div style={styles.fertCard}>
                    <div style={styles.subTitle}>Fertilizer needed</div>
                    <div style={styles.fertRow}>
                      <span style={styles.fertLabel}>Type</span>
                      <span style={styles.fertVal}>{analysis.fertilizer.type}</span>
                    </div>
                    <div style={styles.fertRow}>
                      <span style={styles.fertLabel}>Amount</span>
                      <span style={styles.fertVal}>{analysis.fertilizer.amount}</span>
                    </div>
                    <div style={styles.fertRow}>
                      <span style={styles.fertLabel}>When</span>
                      <span style={styles.fertVal}>{analysis.fertilizer.timing}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "water" && analysis.water && (
              <div>
                <div style={styles.waterStatus}>
                  <span style={styles.waterStatusLabel}>Status</span>
                  <span style={{
                    ...styles.waterStatusVal,
                    color: analysis.water.status === "optimal" ? "#6cc030"
                      : analysis.water.status === "deficit" ? "#cc6622" : "#4488cc"
                  }}>
                    {analysis.water.status?.toUpperCase()}
                  </span>
                </div>
                <div style={styles.waterAction}>{analysis.water.action}</div>
                <div style={styles.subTitle}>Schedule</div>
                <div style={styles.waterSchedule}>{analysis.water.schedule}</div>
              </div>
            )}

            {activeTab === "risks" && (
              <div>
                {analysis.risks?.length === 0 && (
                  <div style={styles.noRisks}>No significant risks detected</div>
                )}
                {analysis.risks?.map((risk, i) => (
                  <div key={i} style={styles.riskCard}>
                    <div style={styles.riskHeader}>
                      <span style={{ ...styles.riskSeverity, color: SEVERITY_COLORS[risk.severity] }}>
                        ⚠ {risk.severity?.toUpperCase()}
                      </span>
                      <span style={styles.riskType}>{risk.type}</span>
                    </div>
                    <div style={styles.riskDesc}>{risk.description}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "bot" && (
              <div>
                <div style={styles.subTitle}>Suggested bot tasks</div>
                {analysis.bot_tasks?.map((task, i) => (
                  <div key={i} style={styles.botTask}>
                    <span style={styles.botTaskNum}>{i + 1}</span>
                    <span style={styles.botTaskText}>{task}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Re-run button */}
          <button style={styles.rerunBtn} onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analyzing..." : "Re-run analysis"}
          </button>
        </>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: "absolute", left: "16px", top: "70px", bottom: "60px",
    width: "280px", background: "rgba(5,14,5,0.94)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(100,180,60,0.18)",
    borderRadius: "14px", zIndex: 20,
    display: "flex", flexDirection: "column",
    overflowY: "auto", fontFamily: "'DM Sans', sans-serif",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 14px 10px", borderBottom: "0.5px solid rgba(100,180,60,0.1)" },
  headerTitle: { fontSize: "13px", fontWeight: "600", color: "#a0e040" },
  headerSub: { fontSize: "11px", color: "rgba(150,210,80,0.5)", marginTop: "2px" },
  closeBtn: { background: "none", border: "none", color: "rgba(150,210,80,0.4)", cursor: "pointer", fontSize: "14px", padding: "0 4px" },
  zoneSummary: { display: "flex", gap: "0", padding: "10px 14px", borderBottom: "0.5px solid rgba(100,180,60,0.08)" },
  zoneItem: { display: "flex", alignItems: "center", gap: "4px", flex: 1 },
  zoneDot: { width: "8px", height: "8px", borderRadius: "2px", flexShrink: 0 },
  zoneLabel: { fontSize: "10px", color: "rgba(150,210,80,0.45)" },
  zoneCount: { fontSize: "12px", fontWeight: "600", color: "#d8f0b0", marginLeft: "2px" },
  cropChip: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", flexWrap: "wrap" },
  cropChipLabel: { fontSize: "10px", color: "rgba(140,200,70,0.45)", textTransform: "uppercase", letterSpacing: "0.5px" },
  cropChipVal: { fontSize: "11px", color: "#c0e080", fontWeight: "500" },
  analyzeBtn: {
    margin: "10px 14px", padding: "10px",
    background: "linear-gradient(135deg, rgba(40,100,15,0.6), rgba(70,160,20,0.4))",
    border: "1px solid rgba(100,200,50,0.35)", borderRadius: "10px",
    color: "#a0e040", fontSize: "13px", fontWeight: "500", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  loadingWrap: { display: "flex", alignItems: "center", gap: "8px" },
  spinner: {
    width: "12px", height: "12px", border: "2px solid rgba(100,200,50,0.3)",
    borderTopColor: "#7cd040", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: { margin: "0 14px 10px", padding: "8px 10px", background: "rgba(200,50,50,0.12)", border: "0.5px solid rgba(200,80,80,0.25)", borderRadius: "8px", color: "#f08080", fontSize: "12px" },
  scoreRow: { display: "flex", gap: "12px", padding: "12px 14px", alignItems: "center", borderTop: "0.5px solid rgba(100,180,60,0.08)" },
  scoreRight: { flex: 1 },
  healthLabel: { fontSize: "15px", fontWeight: "600", color: "#d8f0b0", marginBottom: "4px" },
  summary: { fontSize: "11px", color: "rgba(160,210,100,0.65)", lineHeight: "1.5" },
  tabs: { display: "flex", gap: "0", padding: "0 14px", borderBottom: "0.5px solid rgba(100,180,60,0.1)" },
  tab: { flex: 1, padding: "7px 4px", background: "none", border: "none", color: "rgba(150,210,80,0.45)", fontSize: "11px", cursor: "pointer", borderBottom: "2px solid transparent" },
  tabActive: { color: "#a0e040", borderBottom: "2px solid #7cd040" },
  tabContent: { padding: "10px 14px", flex: 1, overflowY: "auto" },
  subTitle: { fontSize: "10px", fontWeight: "500", color: "rgba(150,210,80,0.45)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px", marginTop: "10px" },
  adviceRow: { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "flex-start" },
  adviceDot: { width: "8px", height: "8px", borderRadius: "2px", marginTop: "3px", flexShrink: 0 },
  adviceText: { fontSize: "11px", color: "rgba(180,230,100,0.7)", lineHeight: "1.5" },
  recCard: { borderRadius: "8px", padding: "8px 10px", marginBottom: "6px" },
  recHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" },
  recPriority: { fontSize: "9px", fontWeight: "600", letterSpacing: "0.5px" },
  recAction: { fontSize: "12px", color: "#d8f0b0", fontWeight: "500" },
  recReason: { fontSize: "11px", color: "rgba(160,210,100,0.6)", lineHeight: "1.4" },
  fertCard: { background: "rgba(20,50,10,0.5)", border: "0.5px solid rgba(80,150,40,0.2)", borderRadius: "8px", padding: "10px", marginTop: "8px" },
  fertRow: { display: "flex", justifyContent: "space-between", marginBottom: "4px" },
  fertLabel: { fontSize: "10px", color: "rgba(140,200,70,0.45)", textTransform: "uppercase" },
  fertVal: { fontSize: "11px", color: "#c0e080" },
  waterStatus: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  waterStatusLabel: { fontSize: "11px", color: "rgba(150,210,80,0.5)" },
  waterStatusVal: { fontSize: "14px", fontWeight: "600" },
  waterAction: { fontSize: "12px", color: "rgba(180,230,100,0.7)", lineHeight: "1.5", marginBottom: "8px" },
  waterSchedule: { fontSize: "11px", color: "rgba(160,210,100,0.6)", lineHeight: "1.5", background: "rgba(20,50,10,0.4)", padding: "8px", borderRadius: "6px" },
  noRisks: { fontSize: "12px", color: "rgba(100,200,60,0.6)", textAlign: "center", padding: "16px 0" },
  riskCard: { background: "rgba(40,15,10,0.5)", border: "0.5px solid rgba(200,80,50,0.2)", borderRadius: "8px", padding: "8px 10px", marginBottom: "6px" },
  riskHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  riskSeverity: { fontSize: "10px", fontWeight: "600" },
  riskType: { fontSize: "12px", color: "#d8f0b0", fontWeight: "500" },
  riskDesc: { fontSize: "11px", color: "rgba(200,160,140,0.7)", lineHeight: "1.4" },
  botTask: { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" },
  botTaskNum: { width: "18px", height: "18px", borderRadius: "50%", background: "rgba(60,130,20,0.3)", border: "0.5px solid rgba(100,180,50,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#a0e040", flexShrink: 0 },
  botTaskText: { fontSize: "11px", color: "rgba(180,230,100,0.7)", lineHeight: "1.5" },
  rerunBtn: { margin: "10px 14px 14px", padding: "8px", background: "none", border: "0.5px solid rgba(100,180,60,0.2)", borderRadius: "8px", color: "rgba(150,210,80,0.5)", fontSize: "12px", cursor: "pointer" },
}