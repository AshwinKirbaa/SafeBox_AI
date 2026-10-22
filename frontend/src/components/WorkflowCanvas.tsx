import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Brain,
  Server,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  HardDrive,
  UserCheck,
  Lock,
  Cpu,
  Layers,
  FolderMinus,
  Globe,
  Split,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Play,
  Grid,
} from 'lucide-react'
import type { RunRecord, InfraCheckResult, RunSummary } from '../types/safebox'
import type { AppPage } from '../types/navigation'

interface WorkflowCanvasProps {
  run: RunRecord | null
  loading: boolean
  allRuns: RunSummary[]
  onSelectRunId: (runId: string) => void
  onNavigate: (page: AppPage) => void
}

interface NodePosition {
  x: number
  y: number
}

const DEFAULT_POSITIONS: Record<string, NodePosition> = {
  origin: { x: 50, y: 260 },
  junction: { x: 380, y: 190 },
  'ai-eval': { x: 680, y: 80 },
  'docker-iso': { x: 680, y: 360 },
  'probe-docker-socket-absence': { x: 1060, y: 150 },
  'probe-non-root-execution': { x: 1060, y: 260 },
  'probe-dropped-capabilities': { x: 1060, y: 370 },
  'probe-resource-limits': { x: 1060, y: 480 },
  'probe-workspace-isolation': { x: 1340, y: 200 },
  'probe-host-filesystem-protection': { x: 1340, y: 310 },
  'probe-network-egress': { x: 1340, y: 420 },
}

const PROBE_METAS = [
  { id: 'docker-socket-absence', name: 'Docker Socket Absence', icon: HardDrive, policy: 'no-docker-socket' },
  { id: 'non-root-execution', name: 'Non-Root Execution', icon: UserCheck, policy: 'non-root-user' },
  { id: 'dropped-capabilities', name: 'Dropped Linux Caps', icon: Lock, policy: 'cap-drop-all' },
  { id: 'resource-limits', name: 'Cgroup Constraints', icon: Cpu, policy: 'bounded-cgroup-resources' },
  { id: 'workspace-isolation', name: 'Workspace Isolation', icon: Layers, policy: 'per-run-workspace-separation' },
  { id: 'host-filesystem-protection', name: 'Host FS Protection', icon: FolderMinus, policy: 'no-prohibited-host-mounts' },
  { id: 'network-egress', name: 'Network Egress Block', icon: Globe, policy: 'egress-deny-all' },
]

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  run,
  loading,
  allRuns,
  onSelectRunId,
  onNavigate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() => {
    try {
      const saved = localStorage.getItem('safebox_node_positions_v2')
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return DEFAULT_POSITIONS
  })

  const [zoom, setZoom] = useState<number>(0.9)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [gridStyle, setGridStyle] = useState<'dots' | 'grid' | 'none'>('dots')

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('origin')
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true)

  // Dragging individual nodes
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  })

  // Save node positions
  useEffect(() => {
    try {
      localStorage.setItem('safebox_node_positions_v2', JSON.stringify(positions))
    } catch {
      // ignore
    }
  }, [positions])

  const checkMap = new Map<string, InfraCheckResult>()
  if (run?.infrastructure?.checks) {
    run.infrastructure.checks.forEach((c) => checkMap.set(c.check_id, c))
  }

  const isRunning = loading || run?.state === 'RUNNING'
  const aiStatus = run?.result?.status || null
  const infraStatus = run?.infrastructure?.status || 'MISSING'

  // Fit to view calculation - accounts for visible canvas surface
  const handleFitToView = useCallback(() => {
    const el = canvasSurfaceRef.current || containerRef.current
    if (!el) return
    const container = el.getBoundingClientRect()
    if (container.width <= 0 || container.height <= 0) return

    const allX = Object.values(positions).map((p) => p.x)
    const allY = Object.values(positions).map((p) => p.y)

    const minX = Math.min(...allX) - 30
    const maxX = Math.max(...allX) + 280
    const minY = Math.min(...allY) - 30
    const maxY = Math.max(...allY) + 160

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY

    const scaleX = (container.width - 60) / graphWidth
    const scaleY = (container.height - 60) / graphHeight
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.0)

    setZoom(newZoom)
    setPan({
      x: Math.round((container.width - graphWidth * newZoom) / 2 - minX * newZoom),
      y: Math.round((container.height - graphHeight * newZoom) / 2 - minY * newZoom),
    })
  }, [positions])

  // Automatically fit graph to view on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitToView()
    }, 60)
    return () => clearTimeout(timer)
  }, [handleFitToView])

  // Reset to default
  const handleResetView = () => {
    setPositions(DEFAULT_POSITIONS)
    setZoom(0.9)
    setPan({ x: 30, y: 30 })
    try {
      localStorage.removeItem('safebox_node_positions_v2')
    } catch {
      // ignore
    }
  }

  // Pan handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-node') || (e.target as HTMLElement).closest('.canvas-controls')) {
      return
    }
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    } else if (draggedNode) {
      const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
      const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
      setPositions((prev) => ({
        ...prev,
        [draggedNode]: {
          x: Math.round(dragStartRef.current.nodeX + dx),
          y: Math.round(dragStartRef.current.nodeY + dy),
        },
      }))
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setDraggedNode(null)
  }

  // Node drag initiation
  const handleStartNodeDrag = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNodeId(nodeId)
    setDraggedNode(nodeId)
    const current = positions[nodeId] || { x: 0, y: 0 }
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: current.x,
      nodeY: current.y,
    }
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setZoom((z) => Math.min(Math.max(z * zoomFactor, 0.4), 2.0))
  }

  // Helper to calculate bezier curved path between two ports
  const makeBezierCurve = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    curveOffset = 80
  ) => {
    const dx = Math.max(Math.abs(toX - fromX) * 0.5, curveOffset)
    return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`
  }

  // Node dimensions for port anchoring
  const originPos = positions.origin || DEFAULT_POSITIONS.origin
  const junctionPos = positions.junction || DEFAULT_POSITIONS.junction
  const aiPos = positions['ai-eval'] || DEFAULT_POSITIONS['ai-eval']
  const dockerPos = positions['docker-iso'] || DEFAULT_POSITIONS['docker-iso']

  return (
    <div
      className="workflow-editor-wrapper"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Top Toolbar */}
      <div className="workflow-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-title-group">
            <span className="toolbar-title">SafeBox Dual-Plane Topology</span>
            <span className="toolbar-badge font-mono">CANVAS v2.0</span>
          </div>

          {/* Active Run Selector Dropdown */}
          <div className="toolbar-run-selector">
            <label htmlFor="workflow-run-select" className="selector-label">Run:</label>
            <select
              id="workflow-run-select"
              className="toolbar-select font-mono"
              value={run?.run_id || ''}
              onChange={(e) => onSelectRunId(e.target.value)}
              disabled={loading}
            >
              {allRuns.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.run_id.slice(0, 18)}... ({r.test_id} · {r.status || 'DONE'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Zoom Level Indicator */}
          <span className="zoom-percentage font-mono">{Math.round(zoom * 100)}%</span>

          {/* Canvas View Controls */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn className="icon-xs" />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut className="icon-xs" />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleFitToView}
            title="Fit to View"
            aria-label="Fit graph to view"
          >
            <Maximize2 className="icon-xs" />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleResetView}
            title="Reset Node Positions"
            aria-label="Reset view layout"
          >
            <RotateCcw className="icon-xs" />
          </button>

          {/* Grid Toggle */}
          <button
            type="button"
            className={`toolbar-btn ${gridStyle !== 'none' ? 'active' : ''}`}
            onClick={() =>
              setGridStyle((g) => (g === 'dots' ? 'grid' : g === 'grid' ? 'none' : 'dots'))
            }
            title={`Canvas Grid: ${gridStyle}`}
            aria-label="Toggle grid style"
          >
            <Grid className="icon-xs" />
          </button>

          {/* Inspect in Run Details Button */}
          {run && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => onNavigate('details')}
              title="Open full inspection report for this run"
            >
              <ExternalLink className="icon-xs" />
              <span>Full Details</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="workflow-main-area">
        <div
          ref={canvasSurfaceRef}
          className={`workflow-canvas-surface canvas-grid-${gridStyle} ${isPanning ? 'panning' : ''}`}
          onMouseDown={handleMouseDownCanvas}
        >
        <div
          className="canvas-transform-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG Connection Layer */}
          <svg className="canvas-svg-layer" width="3000" height="2000">
            <defs>
              <linearGradient id="grad-cyan-stream" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-violet-stream" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-emerald-pass" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Edge 1: Origin -> Junction */}
            <path
              d={makeBezierCurve(originPos.x + 280, originPos.y + 55, junctionPos.x, junctionPos.y + 55)}
              className={`canvas-edge ${isRunning ? 'edge-animated edge-cyan' : 'edge-cyan'}`}
            />

            {/* Edge 2: Junction -> AI Evaluation (Plane A) */}
            <path
              d={makeBezierCurve(junctionPos.x + 220, junctionPos.y + 40, aiPos.x, aiPos.y + 55)}
              className={`canvas-edge ${
                isRunning
                  ? 'edge-animated edge-cyan'
                  : aiStatus === 'PASS'
                  ? 'edge-pass'
                  : aiStatus === 'FAIL'
                  ? 'edge-fail'
                  : 'edge-cyan'
              }`}
            />

            {/* Edge 3: Junction -> Docker Isolation (Plane B) */}
            <path
              d={makeBezierCurve(junctionPos.x + 220, junctionPos.y + 80, dockerPos.x, dockerPos.y + 55)}
              className={`canvas-edge ${
                infraStatus === 'PASS'
                  ? 'edge-pass'
                  : infraStatus === 'FAIL'
                  ? 'edge-fail'
                  : 'edge-violet'
              }`}
            />

            {/* Edges 4..10: Docker Isolation -> 7 Probe Nodes */}
            {PROBE_METAS.map((probe) => {
              const probePos = positions[`probe-${probe.id}`] || DEFAULT_POSITIONS[`probe-${probe.id}`]
              const checkResult = checkMap.get(probe.id)
              const status = checkResult ? checkResult.status : 'MISSING'
              return (
                <path
                  key={probe.id}
                  d={makeBezierCurve(
                    dockerPos.x + 310,
                    dockerPos.y + 55,
                    probePos.x,
                    probePos.y + 35,
                    60
                  )}
                  className={`canvas-edge ${
                    status === 'PASS'
                      ? 'edge-pass'
                      : status === 'FAIL'
                      ? 'edge-fail'
                      : 'edge-neutral'
                  }`}
                />
              )
            })}
          </svg>

          {/* Node 1: Test Origin */}
          <div
            className={`canvas-node node-origin ${selectedNodeId === 'origin' ? 'selected' : ''}`}
            style={{ transform: `translate(${originPos.x}px, ${originPos.y}px)` }}
            onMouseDown={(e) => handleStartNodeDrag('origin', e)}
            onClick={() => setSelectedNodeId('origin')}
            data-testid="workflow-node-origin"
          >
            <div className="node-header">
              <span className="node-stage-tag">STAGE 01</span>
              <span className="node-title">Security Test Origin</span>
              <span className={`node-status-dot dot-${(run?.state || 'IDLE').toLowerCase()}`} />
            </div>
            <div className="node-body">
              <div className="node-badge-primary">
                {run?.target?.mode === 'mock'
                  ? 'MOCK SIMULATOR'
                  : `${(run?.target?.provider || 'OLLAMA').toUpperCase()} · ${run?.target?.model || 'llama3.2:3b'}`}
              </div>
              <div className="node-test-name font-mono">{run?.test_id || 'canary-disclosure'}</div>
              <div className="node-meta-row">
                <span className="text-muted text-xs">Run ID:</span>
                <code className="text-xs font-mono">{run?.run_id ? `${run.run_id.slice(0, 14)}...` : 'N/A'}</code>
              </div>
            </div>
            <div className="node-port port-output" title="Dispatched evaluation request" />
          </div>

          {/* Node 2: Bifurcation Junction */}
          <div
            className={`canvas-node node-junction ${selectedNodeId === 'junction' ? 'selected' : ''}`}
            style={{ transform: `translate(${junctionPos.x}px, ${junctionPos.y}px)` }}
            onMouseDown={(e) => handleStartNodeDrag('junction', e)}
            onClick={() => setSelectedNodeId('junction')}
            data-testid="workflow-node-junction"
          >
            <div className="node-port port-input" />
            <div className="node-header">
              <Split className="node-icon text-cyan" />
              <span className="node-title">Dual-Plane Junction</span>
            </div>
            <div className="node-body">
              <p className="node-desc">
                Decoupled architecture: Independent behavioral evaluation and sandbox isolation.
              </p>
              <div className="junction-badges">
                <span className="junction-pill pill-cyan">PLANE A: AI</span>
                <span className="junction-pill pill-violet">PLANE B: DOCKER</span>
              </div>
            </div>
            <div className="node-port port-output port-output-a" style={{ top: '40px' }} title="Plane A Output" />
            <div className="node-port port-output port-output-b" style={{ top: '80px' }} title="Plane B Output" />
          </div>

          {/* Node 3: AI Behavioral Evaluation (Plane A) */}
          <div
            className={`canvas-node node-ai-eval ${selectedNodeId === 'ai-eval' ? 'selected' : ''}`}
            style={{ transform: `translate(${aiPos.x}px, ${aiPos.y}px)` }}
            onMouseDown={(e) => handleStartNodeDrag('ai-eval', e)}
            onClick={() => setSelectedNodeId('ai-eval')}
            data-testid="workflow-node-ai"
          >
            <div className="node-port port-input" />
            <div className="node-header">
              <Brain className="node-icon text-cyan" />
              <span className="node-title">Plane A: AI Behavioral Safety</span>
              <span className={`node-verdict-pill verdict-${(aiStatus || 'pending').toLowerCase()}`}>
                {aiStatus || 'EVALUATING'}
              </span>
            </div>
            <div className="node-body">
              <div className="node-meta-row">
                <span className="text-muted text-xs">Rule:</span>
                <code className="text-xs font-mono">{run?.result?.rule_id || 'canary-exact-match'}</code>
              </div>
              <div className="node-meta-row">
                <span className="text-muted text-xs">Evidence:</span>
                <span className="text-xs font-mono">{run?.evidence?.length || 0} sanitized items</span>
              </div>
              <div className="node-verdict-summary">
                {aiStatus === 'PASS' && (
                  <span className="text-emerald text-xs flex-center">
                    <ShieldCheck className="icon-xs mr-1" /> Model Adhered to Stated Safety Policy
                  </span>
                )}
                {aiStatus === 'FAIL' && (
                  <span className="text-rose text-xs flex-center">
                    <ShieldAlert className="icon-xs mr-1" /> Model Violated Security Policy
                  </span>
                )}
                {aiStatus === 'ERROR' && (
                  <span className="text-amber text-xs flex-center">
                    <AlertCircle className="icon-xs mr-1" /> Target Inference Error
                  </span>
                )}
                {!aiStatus && <span className="text-muted text-xs">Awaiting evaluation verdict...</span>}
              </div>
            </div>
          </div>

          {/* Node 4: Docker Isolation Gateway (Plane B) */}
          <div
            className={`canvas-node node-docker-iso ${selectedNodeId === 'docker-iso' ? 'selected' : ''}`}
            style={{ transform: `translate(${dockerPos.x}px, ${dockerPos.y}px)` }}
            onMouseDown={(e) => handleStartNodeDrag('docker-iso', e)}
            onClick={() => setSelectedNodeId('docker-iso')}
            data-testid="workflow-node-docker"
          >
            <div className="node-port port-input" />
            <div className="node-header">
              <Server className="node-icon text-violet" />
              <span className="node-title">Plane B: Hardened Docker Sandbox</span>
              <span className={`node-verdict-pill verdict-${infraStatus.toLowerCase()}`}>
                {infraStatus === 'PASS' ? 'ISOLATION PASS' : infraStatus}
              </span>
            </div>
            <div className="node-body">
              <div className="node-meta-row">
                <span className="text-muted text-xs">Probes Verified:</span>
                <strong className="text-xs font-mono">
                  {run?.infrastructure?.checks?.filter((c) => c.status === 'PASS').length || 0} / 7
                </strong>
              </div>
              <p className="node-desc text-xs mt-1">
                {run?.infrastructure?.note || 'Reported independently by worker container.'}
              </p>
            </div>
            <div className="node-port port-output" />
          </div>

          {/* Nodes 5..11: The Seven Infrastructure Probes */}
          {PROBE_METAS.map((probe) => {
            const probePos = positions[`probe-${probe.id}`] || DEFAULT_POSITIONS[`probe-${probe.id}`]
            const submission = checkMap.get(probe.id)
            const status = submission ? submission.status : 'MISSING'
            const Icon = probe.icon
            const isSelected = selectedNodeId === `probe-${probe.id}`

            return (
              <div
                key={probe.id}
                className={`canvas-node node-probe probe-status-${status.toLowerCase()} ${
                  isSelected ? 'selected' : ''
                }`}
                style={{ transform: `translate(${probePos.x}px, ${probePos.y}px)` }}
                onMouseDown={(e) => handleStartNodeDrag(`probe-${probe.id}`, e)}
                onClick={() => setSelectedNodeId(`probe-${probe.id}`)}
                data-testid={`workflow-probe-${probe.id}`}
              >
                <div className="node-port port-input" />
                <div className="probe-node-header">
                  <div className="probe-icon-name">
                    <Icon className="probe-mini-icon" />
                    <span className="probe-label">{probe.name}</span>
                  </div>
                  <span className={`probe-status-pill status-${status.toLowerCase()} font-mono`}>
                    {status}
                  </span>
                </div>
                <div className="probe-node-body">
                  <span className="probe-policy-id font-mono">policy: {probe.policy}</span>
                  <div className="probe-observed-preview">
                    {submission?.observed
                      ? submission.observed.slice(0, 36) + (submission.observed.length > 36 ? '...' : '')
                      : 'Unverified / not submitted yet'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Floating Canvas Legend docked inside canvas surface */}
        <div className="canvas-legend">
          <span className="legend-item"><span className="legend-dot dot-pass" /> PASS</span>
          <span className="legend-item"><span className="legend-dot dot-fail" /> FAIL</span>
          <span className="legend-item"><span className="legend-dot dot-missing" /> MISSING</span>
          <span className="legend-item"><span className="legend-dot dot-cyan" /> AI PLANE</span>
          <span className="legend-item"><span className="legend-dot dot-violet" /> DOCKER PLANE</span>
        </div>
      </div>

      {/* Collapsible Selected-Node Inspector Panel */}
      {isInspectorOpen && (
        <aside className="workflow-inspector" aria-label="Node Inspector">
          <div className="inspector-header">
            <span className="inspector-title">Node Inspector</span>
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => setIsInspectorOpen(false)}
              title="Collapse Inspector"
              aria-label="Collapse inspector"
            >
              <ChevronRight className="icon-xs" />
            </button>
          </div>

          <div className="inspector-content">
            {selectedNodeId === 'origin' && (
              <div className="inspector-section">
                <div className="inspector-badge">STAGE 01 TRIGGER</div>
                <h4 className="inspector-node-title">Security Test Origin</h4>
                <div className="inspector-data-list">
                  <div className="data-item">
                    <span className="item-label">Test ID:</span>
                    <strong className="item-value font-mono">{run?.test_id || 'canary-disclosure'}</strong>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Target Engine:</span>
                    <strong className="item-value font-mono">{run?.target?.mode?.toUpperCase() || 'MOCK'}</strong>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Model:</span>
                    <span className="item-value font-mono">{run?.target?.model || 'default'}</span>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Execution State:</span>
                    <span className="item-value font-mono">{run?.state || 'COMPLETED'}</span>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Created At:</span>
                    <span className="item-value text-muted">{run?.created_at ? new Date(run.created_at).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm mt-3 w-full"
                  onClick={() => onNavigate('test-lab')}
                >
                  <Play className="icon-xs" />
                  <span>Launch New Test in Lab</span>
                </button>
              </div>
            )}

            {selectedNodeId === 'junction' && (
              <div className="inspector-section">
                <div className="inspector-badge">ARCHITECTURE TOPOLOGY</div>
                <h4 className="inspector-node-title">Dual-Plane Junction</h4>
                <p className="inspector-desc">
                  SafeBox AI decouples prompt behavioral evaluations from container infrastructure boundaries.
                  Each plane executes and verifies independently. A breach in one plane does not falsify or invalidate evidence in the other.
                </p>
                <div className="inspector-card-highlight">
                  <div className="highlight-row">
                    <span className="text-cyan font-semibold">Plane A:</span> Synchronous Behavioral Policy
                  </div>
                  <div className="highlight-row mt-1">
                    <span className="text-violet font-semibold">Plane B:</span> Hardened Docker Sandbox
                  </div>
                </div>
              </div>
            )}

            {selectedNodeId === 'ai-eval' && (
              <div className="inspector-section">
                <div className="inspector-badge">MEMBER 1 EVALUATOR</div>
                <h4 className="inspector-node-title">AI Behavioral Safety</h4>
                <div className="inspector-data-list">
                  <div className="data-item">
                    <span className="item-label">Verdict:</span>
                    <strong className={`item-value text-${(aiStatus || 'missing').toLowerCase()}`}>
                      {aiStatus || 'PENDING'}
                    </strong>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Rule ID:</span>
                    <code className="item-value font-mono">{run?.result?.rule_id || 'N/A'}</code>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Explanation:</span>
                    <p className="inspector-explanation">{run?.result?.explanation || 'No explanation recorded.'}</p>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Sanitized Evidence:</span>
                    <span className="item-value font-mono">{run?.evidence?.length || 0} recorded outputs</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm mt-3 w-full"
                  onClick={() => onNavigate('details')}
                >
                  <ExternalLink className="icon-xs" />
                  <span>Inspect Evidence & Policy</span>
                </button>
              </div>
            )}

            {selectedNodeId === 'docker-iso' && (
              <div className="inspector-section">
                <div className="inspector-badge">MEMBER 2 SANDBOX</div>
                <h4 className="inspector-node-title">Hardened Docker Sandbox</h4>
                <div className="inspector-data-list">
                  <div className="data-item">
                    <span className="item-label">Aggregate Status:</span>
                    <strong className={`item-value text-${infraStatus.toLowerCase()}`}>
                      {infraStatus === 'PASS' ? 'ISOLATION PASS' : infraStatus}
                    </strong>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Submissions:</span>
                    <span className="item-value font-mono">
                      {run?.infrastructure?.checks?.length || 0} of 7 checks reported
                    </span>
                  </div>
                  <div className="data-item">
                    <span className="item-label">Sandbox Note:</span>
                    <p className="inspector-explanation">{run?.infrastructure?.note || 'No note available.'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm mt-3 w-full"
                  onClick={() => onNavigate('details')}
                >
                  <ExternalLink className="icon-xs" />
                  <span>View All 7 Checks</span>
                </button>
              </div>
            )}

            {selectedNodeId?.startsWith('probe-') && (() => {
              const probeId = selectedNodeId.replace('probe-', '')
              const probeMeta = PROBE_METAS.find((p) => p.id === probeId)
              const checkData = checkMap.get(probeId)
              const status = checkData ? checkData.status : 'MISSING'

              return (
                <div className="inspector-section">
                  <div className="inspector-badge">ISOLATION PROBE</div>
                  <h4 className="inspector-node-title">{probeMeta?.name || probeId}</h4>
                  <div className="inspector-data-list">
                    <div className="data-item">
                      <span className="item-label">Probe Status:</span>
                      <strong className={`item-value text-${status.toLowerCase()}`}>{status}</strong>
                    </div>
                    <div className="data-item">
                      <span className="item-label">Policy Identifier:</span>
                      <code className="item-value font-mono">{checkData?.policy_id || probeMeta?.policy}</code>
                    </div>
                    <div className="data-item">
                      <span className="item-label">Observed:</span>
                      <div className="inspector-code-block font-mono">
                        {checkData?.observed || 'Not observed / unverified'}
                      </div>
                    </div>
                    <div className="data-item">
                      <span className="item-label">Expected:</span>
                      <div className="inspector-code-block font-mono">
                        {checkData?.expected || 'Enforced isolation boundary'}
                      </div>
                    </div>
                    {checkData?.evidence_ref && (
                      <div className="data-item">
                        <span className="item-label">Evidence Ref:</span>
                        <code className="item-value font-mono">{checkData.evidence_ref}</code>
                      </div>
                    )}
                    {checkData?.limitation && (
                      <div className="data-item">
                        <span className="item-label">Limitation:</span>
                        <span className="item-value text-amber text-xs">{checkData.limitation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {!selectedNodeId && (
              <div className="inspector-empty">
                <HelpCircle className="empty-icon" />
                <p>Click on any node in the canvas to inspect its parameters, execution state, and data flows.</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Floating expand inspector button when collapsed */}
      {!isInspectorOpen && (
        <button
          type="button"
          className="btn-expand-inspector"
          onClick={() => setIsInspectorOpen(true)}
          title="Open Node Inspector"
          aria-label="Open node inspector"
        >
          <ChevronRight className="icon-xs" style={{ transform: 'rotate(180deg)' }} />
          <span>Inspector</span>
        </button>
      )}
      </div>
    </div>
  )
}
