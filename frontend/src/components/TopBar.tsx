import React from 'react'
import {
  RefreshCw,
  Activity,
  Cpu,
  AlertCircle,
  Play,
} from 'lucide-react'
import type { AppPage } from '../types/navigation'
import type { HealthResponse, RunRecord } from '../types/safebox'

interface TopBarProps {
  activePage: AppPage
  selectedRun: RunRecord | null
  health: HealthResponse | null
  loadingHealth: boolean
  healthError: string | null
  onRefresh: () => void
  onNavigate: (page: AppPage) => void
}

const PAGE_TITLES: Record<AppPage, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operations Overview',
    subtitle: 'Security posture, active engine status & recent evaluations',
  },
  'test-lab': {
    title: 'Adversarial Test Lab',
    subtitle: 'Execute benchmark safety policies & multi-provider red-teaming',
  },
  workflow: {
    title: 'Interactive Topology Workflow',
    subtitle: 'Node-based decoupled dual-plane pipeline and container isolation probes',
  },
  runs: {
    title: 'Run Explorer',
    subtitle: 'Telemetry archive of all evaluated model safety runs',
  },
  details: {
    title: 'Run Inspection & Evidence',
    subtitle: 'In-depth verdicts, sanitized model output & sandbox verification',
  },
}

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  selectedRun,
  health,
  loadingHealth,
  healthError,
  onRefresh,
  onNavigate,
}) => {
  const pageMeta = PAGE_TITLES[activePage] || {
    title: 'SafeBox AI',
    subtitle: 'Security Dashboard',
  }

  return (
    <header className="app-topbar">
      {/* Left: Page Title & Breadcrumb */}
      <div className="topbar-left">
        <div className="topbar-breadcrumbs">
          <span className="breadcrumb-root">SafeBox AI</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{pageMeta.title}</span>
        </div>
        <p className="topbar-subtitle">{pageMeta.subtitle}</p>
      </div>

      {/* Middle: Active Run Indicator Badge */}
      <div className="topbar-middle">
        {selectedRun ? (
          <div
            className="topbar-run-pill cursor-target"
            onClick={() => onNavigate('details')}
            title="Click to view full run details"
            role="button"
            tabIndex={0}
            data-cursor-label="Inspect Run"
          >
            <span className="run-pill-label">ACTIVE RUN:</span>
            <code className="run-pill-id font-mono">
              {selectedRun.run_id.length > 20
                ? `${selectedRun.run_id.slice(0, 16)}...`
                : selectedRun.run_id}
            </code>
            <span className="run-pill-target font-mono">
              {selectedRun.target.mode === 'mock'
                ? 'MOCK'
                : selectedRun.target.model || selectedRun.target.mode}
            </span>
            <span
              className={`run-pill-status status-dot-${(
                selectedRun.result?.status || 'PENDING'
              ).toLowerCase()}`}
            />
          </div>
        ) : (
          <div className="topbar-run-pill pill-idle">
            <span className="run-pill-label">NO ACTIVE RUN</span>
          </div>
        )}
      </div>

      {/* Right: Consolidated System Status & Global Actions */}
      <div className="topbar-right">
        {/* Unified System Health Status */}
        <div
          className={`status-pill ${
            healthError ? 'status-pill-error' : 'status-pill-ok'
          }`}
          title={
            healthError
              ? `Backend Connection Error: ${healthError}`
              : `Backend Live · SQLite: ${health?.database_ok ? 'Connected' : 'Offline'} · Target: ${health?.target_mode?.toUpperCase() || 'MOCK'}${health?.ollama?.reachable ? ' · Ollama: Ready' : ''}`
          }
        >
          {healthError ? (
            <AlertCircle className="pill-icon text-rose" />
          ) : (
            <Activity className="pill-icon text-emerald" />
          )}
          <span className="pill-label font-mono">
            {healthError ? 'API OFFLINE' : 'SYSTEM READY'}
          </span>
        </div>

        {/* Active Engine Target */}
        <div
          className="status-pill status-pill-neutral font-mono"
          title={`Active execution engine: ${health?.target_mode || 'mock'}`}
        >
          <Cpu className="pill-icon text-cyan" />
          <span className="pill-label">
            {health?.target_mode === 'mock'
              ? 'MOCK'
              : health?.ollama?.configured_model || health?.target_mode?.toUpperCase() || 'MOCK'}
          </span>
        </div>

        {/* Refresh Action */}
        <button
          type="button"
          className="btn-refresh cursor-target"
          onClick={onRefresh}
          disabled={loadingHealth}
          title="Refresh dashboard state & data"
          aria-label="Refresh dashboard"
          data-cursor-label="Refresh"
        >
          <RefreshCw
            className={`refresh-icon ${loadingHealth ? 'spin' : ''}`}
          />
        </button>

        {/* Quick Launch CTA if not on test lab */}
        {activePage !== 'test-lab' && (
          <button
            type="button"
            className="btn-primary btn-sm btn-quick-launch cursor-target"
            onClick={() => onNavigate('test-lab')}
            data-testid="topbar-launch-btn"
            data-cursor-label="Launch Test"
          >
            <Play className="icon-xs" />
            <span>Launch Test</span>
          </button>
        )}
      </div>
    </header>
  )
}
