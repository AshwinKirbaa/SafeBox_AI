import React, { useState } from 'react'
import {
  Activity,
  Layers,
  FlaskConical,
  Network,
  History,
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
  onSelectRun,
  onNavigate,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Compute genuine statistics from actual run records
  const evaluatedCount = runs.length
  const passCount = runs.filter((r) => r.status === 'PASS').length
  const failCount = runs.filter((r) => r.status === 'FAIL').length
  const passRate = evaluatedCount > 0 ? Math.round((passCount / evaluatedCount) * 100) : 0

  const recentRuns = runs.slice(0, 5)

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
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('test-lab')}
              data-testid="hero-launch-btn"
            >
              <FlaskConical className="icon-xs" />
              <span>Launch Security Test</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigate('workflow')}
            >
              <Network className="icon-xs" />
              <span>Open Topology Canvas</span>
            </button>
          </div>
        </div>

        <div className="hero-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Evaluations</span>
            <div className="stat-value font-mono">{totalRuns}</div>
            <span className="stat-sub">Persisted in SQLite database</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Recent Pass Rate</span>
            <div className="stat-value font-mono text-emerald">{passRate}%</div>
            <span className="stat-sub">{passCount} passed of {evaluatedCount} recent</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Violations Detected</span>
            <div className="stat-value font-mono text-rose">{failCount}</div>
            <span className="stat-sub">
              {failCount === 0 ? 'Zero adversarial leaks' : `${failCount} policy breaches`}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Engine</span>
            <div className="stat-value font-mono text-cyan text-sm">
              {health?.target_mode === 'mock'
                ? 'MOCK SIMULATOR'
                : health?.ollama?.configured_model || health?.target_mode?.toUpperCase() || 'MOCK'}
            </div>
            <span className="stat-sub">
              {health?.ollama?.reachable ? 'Ollama daemon live' : 'Deterministic mock engine'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Infrastructure Readiness & Active Audit Spotlight */}
      <div className="overview-bento-grid">
        {/* Card 1: System Readiness Matrix */}
        <div className="card bento-card">
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
        </div>

        {/* Card 2: Active Run Spotlight */}
        <div className="card bento-card">
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
                      className="btn-ghost-sm btn-copy-inline"
                      onClick={() => handleCopy(selectedRun.run_id)}
                      title="Copy full Run ID"
                      aria-label="Copy Run ID"
                    >
                      {copiedId === selectedRun.run_id ? (
                        <Check className="icon-xs text-emerald" />
                      ) : (
                        <Copy className="icon-xs" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={() => onNavigate('details')}
                >
                  <span>Full Report</span>
                  <ArrowRight className="icon-xs ml-1" />
                </button>
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
                  className="btn-secondary btn-sm"
                  onClick={() => onNavigate('workflow')}
                >
                  <Network className="icon-xs" />
                  <span>Inspect in Workflow Canvas</span>
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => onNavigate('details')}
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
        </div>
      </div>

      {/* Recent Evaluations Table */}
      <div className="card mt-4">
        <div className="card-header">
          <div className="card-header-title">
            <History className="card-header-icon text-cyan" />
            <h2>Recent Security Evaluations ({recentRuns.length})</h2>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => onNavigate('runs')}
          >
            <span>View All in Run Explorer</span>
            <ArrowRight className="icon-xs ml-1" />
          </button>
        </div>

        <div className="table-responsive">
          <table className="overview-runs-table">
            <thead>
              <tr>
                <th>RUN ID</th>
                <th>TEST BENCHMARK</th>
                <th>TARGET MODEL</th>
                <th>AI VERDICT</th>
                <th>TIMESTAMP</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => {
                const isSelected = selectedRun?.run_id === r.run_id
                return (
                  <tr key={r.run_id} className={isSelected ? 'row-selected' : ''}>
                    <td>
                      <code className="font-mono text-xs">{r.run_id.slice(0, 16)}...</code>
                    </td>
                    <td>
                      <span className="font-semibold text-xs">{r.test_id}</span>
                      <span className="text-muted text-xs ml-1 font-mono">v{r.test_version}</span>
                    </td>
                    <td>
                      <span className="target-pill font-mono text-xs">
                        {r.target_mode === 'mock' ? 'MOCK' : r.model || r.target_mode}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm font-mono ${
                        r.status === 'PASS'
                          ? 'badge-pass'
                          : r.status === 'FAIL'
                          ? 'badge-fail'
                          : 'badge-pending'
                      }`}>
                        {r.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="text-muted text-xs font-mono">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <div className="action-button-group">
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => {
                            onSelectRun(r.run_id)
                            onNavigate('details')
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          onClick={() => {
                            onSelectRun(r.run_id)
                            onNavigate('workflow')
                          }}
                          title="Open in Workflow Canvas"
                          aria-label="Open in Workflow Canvas"
                        >
                          <Network className="icon-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {recentRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No runs recorded yet. Launch your first test from the Test Lab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

