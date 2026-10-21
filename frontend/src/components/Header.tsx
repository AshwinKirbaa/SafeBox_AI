import React from 'react'
import {
  ShieldCheck,
  RefreshCw,
  Database,
  Cpu,
  Activity,
  Server,
  AlertCircle,
} from 'lucide-react'
import type { HealthResponse } from '../types/safebox'

interface HeaderProps {
  health: HealthResponse | null
  loadingHealth: boolean
  healthError: string | null
  onRefresh: () => void
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loadingHealth,
  healthError,
  onRefresh,
}) => {
  return (
    <header className="header-container">
      <div className="header-brand">
        <div className="logo-shield">
          <ShieldCheck className="logo-icon" />
        </div>
        <div>
          <div className="title-row">
            <h1 className="header-title">SafeBox AI</h1>
            <span className="version-pill">
              v{health?.version || '1.0.0'}
            </span>
            <span className="env-pill">
              {health?.environment || 'development'}
            </span>
          </div>
          <p className="header-subtitle">
            Autonomous AI Red-Teaming & Hardened Sandbox Isolation Verification
          </p>
        </div>
      </div>

      <div className="header-status-group">
        {/* Backend Liveness */}
        <div
          className={`status-pill ${
            healthError ? 'status-pill-error' : 'status-pill-ok'
          }`}
          title={
            healthError
              ? `Backend Connection Error: ${healthError}`
              : `Backend Live at ${health?.time}`
          }
        >
          {healthError ? (
            <AlertCircle className="pill-icon text-rose" />
          ) : (
            <Activity className="pill-icon text-emerald" />
          )}
          <span className="pill-label">
            {healthError ? 'API OFFLINE' : 'API LIVE'}
          </span>
        </div>

        {/* Default Server Target Mode */}
        <div className="status-pill status-pill-neutral" title="Default server execution mode configured on backend">
          <Cpu className="pill-icon text-cyan" />
          <span className="pill-label">
            DEFAULT MODE: <strong>{health?.target_mode.toUpperCase() || 'MOCK'}</strong>
          </span>
        </div>

        {/* Database Status */}
        <div className="status-pill status-pill-neutral">
          <Database className="pill-icon text-violet" />
          <span className="pill-label">
            SQLITE:{' '}
            <strong>
              {health?.database_ok ? 'CONNECTED' : 'DISCONNECTED'}
            </strong>
          </span>
        </div>

        {/* Ollama Status */}
        {health?.ollama && (
          <div
            className={`status-pill ${
              health.ollama.reachable && health.ollama.model_available
                ? 'status-pill-ok'
                : health.ollama.reachable
                ? 'status-pill-warning'
                : 'status-pill-error'
            }`}
          >
            <Server className="pill-icon" />
            <span className="pill-label">
              OLLAMA:{' '}
              {health.ollama.reachable
                ? `${health.ollama.configured_model} ${
                    health.ollama.model_available ? '(READY)' : '(MISSING)'
                  }`
                : 'OFFLINE'}
            </span>
          </div>
        )}

        {/* Refresh Action */}
        <button
          className="btn-refresh"
          onClick={onRefresh}
          disabled={loadingHealth}
          title="Refresh dashboard state & run history"
        >
          <RefreshCw
            className={`refresh-icon ${loadingHealth ? 'spin' : ''}`}
          />
        </button>
      </div>
    </header>
  )
}
