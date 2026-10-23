import React, { useState } from 'react'
import {
  Activity,
  Layers,
  FlaskConical,
  Network,
  FileSearch,
  Server,
  Database,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import MagicBento, { BentoCard, type MagicBentoItem } from '../components/MagicBento'
import { SafeBoxMagnet } from '../components/SafeBoxMagnet'
import type { HealthResponse, RunSummary, RunRecord } from '../types/safebox'
import type { AppPage } from '../types/navigation'

interface OverviewPageProps {
  health: HealthResponse | null
  healthError: string | null
  runs: RunSummary[]
  totalRuns: number
  selectedRun: RunRecord | null
  onSelectRun: (runId: string) => void
  onNavigate: (page: AppPage) => void
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  health,
  healthError,
  runs,
  totalRuns,
  selectedRun,
  onSelectRun: _onSelectRun,
  onNavigate,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Compute genuine statistics from actual run records
  const evaluatedCount = runs.length
  const passCount = runs.filter((r) => r.status === 'PASS').length
  const failCount = runs.filter((r) => r.status === 'FAIL').length
  const passRate = evaluatedCount > 0 ? Math.round((passCount / evaluatedCount) * 100) : 0

  const engineDisplay = health?.target_mode === 'mock'
    ? 'MOCK SIMULATOR'
    : health?.ollama?.configured_model || health?.target_mode?.toUpperCase() || 'MOCK'

  const metricBentoItems: MagicBentoItem[] = [
    {
      id: 'metric-total-runs',
      label: 'TELEMETRY ARCHIVE',
      icon: <Database className="icon-xs text-cyan" />,
      content: (
        <div className="stat-card">
          <span className="stat-label">Total Evaluations</span>
          <div className="stat-value font-mono">{totalRuns}</div>
          <span className="stat-sub">Persisted in SQLite database</span>
        </div>
      ),
      onClick: () => onNavigate('runs'),
    },
    {
      id: 'metric-pass-rate',
      label: 'BENCHMARK ACCURACY',
      icon: <ShieldCheck className="icon-xs text-emerald" />,
      content: (
        <div className="stat-card">
          <span className="stat-label">Recent Pass Rate</span>
          <div className="stat-value font-mono text-emerald">{passRate}%</div>
          <span className="stat-sub">{passCount} passed of {evaluatedCount} recent</span>
        </div>
      ),
      onClick: () => onNavigate('runs'),
    },
    {
      id: 'metric-violations',
      label: 'POLICY ENFORCEMENT',
      icon: <ShieldAlert className="icon-xs text-rose" />,
      content: (
        <div className="stat-card">
          <span className="stat-label">Violations Detected</span>
          <div className="stat-value font-mono text-rose">{failCount}</div>
          <span className="stat-sub">
            {failCount === 0 ? 'Zero adversarial leaks' : `${failCount} policy breaches`}
          </span>
        </div>
      ),
      onClick: () => onNavigate('runs'),
    },
    {
      id: 'metric-engine',
      label: 'INFERENCE RUNTIME',
      icon: <Activity className="icon-xs text-cyan" />,
      content: (
        <div className="stat-card">
          <span className="stat-label">Active Engine</span>
          <div className="stat-value font-mono text-cyan text-sm">{engineDisplay}</div>
          <span className="stat-sub">
            {health?.ollama?.reachable ? 'Ollama daemon live' : 'Deterministic mock engine'}
          </span>
        </div>
      ),
      onClick: () => onNavigate('test-lab'),
    },
  ]

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedId(text)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  return (
    <div className="page-container overview-page">
      {/* Top Welcome / Platform Hero */}
      <div className="overview-hero-card">
        <div className="hero-content">
          <h1 className="hero-title">SafeBox AI Defense Platform</h1>
          <p className="hero-description">
            Autonomous dual-plane security benchmarking. Evaluates AI model behavioral compliance
            against prompt injection and secret canary extraction, while independently validating
            the 7 hardened Linux container sandbox security boundaries.
          </p>
          <div className="hero-actions">
            <SafeBoxMagnet maxDisplacement={6} range={80}>
              <button
                type="button"
                className="btn-primary cursor-target"
                onClick={() => onNavigate('test-lab')}
                data-testid="hero-launch-btn"
                data-cursor-label="Launch Test"
              >
                <FlaskConical className="icon-xs" />
                <span>Launch Security Test</span>
              </button>
            </SafeBoxMagnet>
            <SafeBoxMagnet maxDisplacement={5} range={75}>
              <button
                type="button"
                className="btn-secondary cursor-target"
                onClick={() => onNavigate('workflow')}
                data-cursor-label="Canvas"
              >
                <Network className="icon-xs" />
                <span>Open Topology Canvas</span>
              </button>
            </SafeBoxMagnet>
          </div>
        </div>

        {/* Operational Security Posture & Engine Readiness Right Column */}
        <div className="hero-status-panel" data-testid="hero-status-panel">
          <div className="hero-status-header">
            <div className="hero-status-header-title">
              <ShieldCheck className="icon-xs text-cyan" />
              <span>Operational Posture</span>
            </div>
            <span className={`status-pill ${healthError ? 'status-pill-error' : 'status-pill-ok'}`}>
              <span className="badge-pulse-dot" />
              <span>{healthError ? 'API OFFLINE' : 'SYSTEM READY'}</span>
            </span>
          </div>

          <div className="hero-status-grid">
            <div className="hero-status-tile">
              <span className="hero-tile-label">INFERENCE TARGET</span>
              <div className="hero-tile-val font-mono">{engineDisplay}</div>
              <span className="hero-tile-sub">
                {health?.ollama?.reachable ? 'Ollama daemon live' : 'Mock fallback engine'}
              </span>
            </div>

            <div className="hero-status-tile">
              <span className="hero-tile-label">CONTAINER SANDBOX</span>
              <div className="hero-tile-val font-mono">
                {selectedRun?.infrastructure.status === 'PASS' ? '7/7 Probes Hardened' : 'Hardened Sandbox'}
              </div>
              <span className="hero-tile-sub">Member 2 Linux isolation</span>
            </div>

            <div className="hero-status-tile">
              <span className="hero-tile-label">TELEMETRY ARCHIVE</span>
              <div className="hero-tile-val font-mono">
                {health?.database_ok ? 'SQLite Connected' : 'Database Offline'}
              </div>
              <span className="hero-tile-sub">{totalRuns} persistent records</span>
            </div>

            <div className="hero-status-tile">
              <span className="hero-tile-label">EVALUATION MODE</span>
              <div className="hero-tile-val font-mono text-cyan">
                {selectedRun?.result?.status ? `Last: ${selectedRun.result.status}` : 'Dual-Plane Audit'}
              </div>
              <span className="hero-tile-sub">
                {selectedRun ? `Run: ${selectedRun.run_id.slice(0, 12)}...` : 'Ready for test launch'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Telemetry Metrics MagicBento Grid */}
      <div className="overview-metrics-bento" data-testid="overview-metrics-bento">
        <MagicBento
          items={metricBentoItems}
          columns={4}
          rowHeight={120}
          gap={14}
          radius={12}
          glowColor="#38bdf8"
          enableBorderGlow={true}
          enableSpotlight={true}
          spotlightRadius={240}
          clickEffect={true}
        />
      </div>

      {/* Main Grid: Infrastructure Readiness & Active Audit Spotlight */}
      <div className="overview-bento-grid">
        {/* Card 1: System Readiness Matrix */}
        <BentoCard className="bento-card" glowColor="#38bdf8">
          <div className="card-header">
            <div className="card-header-title">
              <Activity className="card-header-icon text-cyan" />
              <h2>System & Engine Readiness</h2>
            </div>
            <span className={`status-pill ${healthError ? 'status-pill-error' : 'status-pill-ok'}`}>
              {healthError ? 'API OFFLINE' : 'HEALTHY'}
            </span>
          </div>
          <div className="bento-matrix-list">
            <div className="matrix-item">
              <div className="item-title-group">
                <Server className="item-icon text-cyan" />
                <div>
                  <div className="item-name">FastAPI Core Service</div>
                  <div className="item-desc">REST API & Security Evaluator rules engine</div>
                </div>
              </div>
              <span className={`badge badge-sm font-mono ${healthError ? 'badge-fail' : 'badge-pass'}`}>
                {healthError ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>

            <div className="matrix-item">
              <div className="item-title-group">
                <Database className="item-icon text-violet" />
                <div>
                  <div className="item-name">SQLite Telemetry Database</div>
                  <div className="item-desc">Persistent run records, evidence and checks</div>
                </div>
              </div>
              <span className={`badge badge-sm font-mono ${health?.database_ok ? 'badge-pass' : 'badge-fail'}`}>
                {health?.database_ok ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>

            <div className="matrix-item">
              <div className="item-title-group">
                <Activity className="item-icon text-emerald" />
                <div>
                  <div className="item-name">Ollama Local Engine</div>
                  <div className="item-desc">
                    {health?.ollama?.reachable
                      ? `Model ${health.ollama.configured_model} (${health.ollama.model_available ? 'Available' : 'Missing'})`
                      : 'Ollama service offline / using mock fallback'}
                  </div>
                </div>
              </div>
              <span
                className={`badge badge-sm font-mono ${
                  health?.ollama?.reachable && health?.ollama?.model_available
                    ? 'badge-pass'
                    : health?.ollama?.reachable
                    ? 'badge-warning'
                    : 'badge-missing'
                }`}
              >
                {health?.ollama?.reachable ? 'READY' : 'OFFLINE'}
              </span>
            </div>

            <div className="matrix-item">
              <div className="item-title-group">
                <Layers className="item-icon text-amber" />
                <div>
                  <div className="item-name">Member 2 Docker Sandbox</div>
                  <div className="item-desc">Hardened container worker with 7 boundary probes</div>
                </div>
              </div>
              <span className="badge badge-sm badge-pass font-mono">SUPPORTED</span>
            </div>
          </div>
        </BentoCard>

        {/* Card 2: Active Run Spotlight */}
        <BentoCard className="bento-card" glowColor="#c084fc">
          <div className="card-header">
            <div className="card-header-title">
              <FileSearch className="card-header-icon text-violet" />
              <h2>Active Audit Inspection</h2>
            </div>
            {selectedRun && (
              <span className={`badge badge-sm font-mono ${
                selectedRun.result?.status === 'PASS'
                  ? 'badge-pass'
                  : selectedRun.result?.status === 'FAIL'
                  ? 'badge-fail'
                  : 'badge-pending'
              }`}>
                {selectedRun.result?.status || 'RUNNING'}
              </span>
            )}
          </div>

          {selectedRun ? (
            <div className="active-run-spotlight">
              <div className="spotlight-header">
                <div className="spotlight-id-box">
                  <span className="spotlight-id-label">AUDIT RUN ID:</span>
                  <div className="spotlight-id-val-row">
                    <code className="font-mono text-sm font-semibold">{selectedRun.run_id}</code>
                    <button
                      type="button"
                      className="btn-ghost-sm btn-copy-inline cursor-target"
                      onClick={() => handleCopy(selectedRun.run_id)}
                      title="Copy full Run ID"
                      aria-label="Copy Run ID"
                      data-cursor-label="Copy ID"
                    >
                      {copiedId === selectedRun.run_id ? (
                        <Check className="icon-xs text-emerald" />
                      ) : (
                        <Copy className="icon-xs" />
                      )}
                    </button>
                  </div>
                </div>
                <SafeBoxMagnet maxDisplacement={4} range={65}>
                  <button
                    type="button"
                    className="btn-secondary btn-xs cursor-target"
                    onClick={() => onNavigate('details')}
                    data-cursor-label="Report"
                  >
                    <span>Full Report</span>
                    <ArrowRight className="icon-xs ml-1" />
                  </button>
                </SafeBoxMagnet>
              </div>

              <div className="spotlight-meta-grid">
                <div className="meta-cell">
                  <span className="cell-label">Test Benchmark</span>
                  <strong className="cell-value font-mono">{selectedRun.test_id}</strong>
                </div>
                <div className="meta-cell">
                  <span className="cell-label">Target Engine</span>
                  <strong className="cell-value font-mono">
                    {selectedRun.target.mode === 'mock'
                      ? 'Mock Simulator'
                      : selectedRun.target.model || selectedRun.target.mode}
                  </strong>
                </div>
                <div className="meta-cell">
                  <span className="cell-label">AI Safety Verdict</span>
                  <div className="cell-value-badge">
                    {selectedRun.result?.status === 'PASS' && (
                      <span className="badge badge-sm badge-pass font-mono">
                        <ShieldCheck className="badge-icon" />
                        <span>PASS (Adhered)</span>
                      </span>
                    )}
                    {selectedRun.result?.status === 'FAIL' && (
                      <span className="badge badge-sm badge-fail font-mono">
                        <ShieldAlert className="badge-icon" />
                        <span>FAIL (Policy Breach)</span>
                      </span>
                    )}
                    {selectedRun.result?.status === 'ERROR' && (
                      <span className="badge badge-sm badge-error font-mono">ERROR</span>
                    )}
                    {!selectedRun.result && (
                      <span className="badge badge-sm badge-pending font-mono">PENDING</span>
                    )}
                  </div>
                </div>
                <div className="meta-cell">
                  <span className="cell-label">Docker Isolation</span>
                  <div className="cell-value-badge">
                    <span className={`badge badge-sm font-mono ${
                      selectedRun.infrastructure.status === 'PASS' ? 'badge-pass' : 'badge-missing'
                    }`}>
                      {selectedRun.infrastructure.status === 'PASS'
                        ? 'ISOLATION PASS (7/7)'
                        : selectedRun.infrastructure.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="spotlight-explanation-box">
                <span className="explanation-label">EVALUATOR REASONING:</span>
                <p className="spotlight-explanation">
                  {selectedRun.result?.explanation || 'No AI policy explanation recorded.'}
                </p>
              </div>

              <div className="spotlight-quick-links">
                <button
                  type="button"
                  className="btn-secondary btn-sm cursor-target"
                  onClick={() => onNavigate('workflow')}
                  data-cursor-label="Canvas"
                >
                  <Network className="icon-xs" />
                  <span>Inspect in Workflow Canvas</span>
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm cursor-target"
                  onClick={() => onNavigate('details')}
                  data-cursor-label="Probes"
                >
                  <FileSearch className="icon-xs" />
                  <span>Inspect Evidence & Probes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="spotlight-empty">
              <HelpCircle className="empty-icon" />
              <p>No test run selected yet. Launch a test or select one from the explorer.</p>
              <button
                type="button"
                className="btn-primary btn-sm mt-3"
                onClick={() => onNavigate('test-lab')}
              >
                Launch Test in Lab
              </button>
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  )
}


