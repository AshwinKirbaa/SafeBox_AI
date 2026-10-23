import React from 'react'
import {
  ShieldCheck,
  LayoutDashboard,
  FlaskConical,
  Network,
  History,
  FileSearch,
  Server,
  Activity,
  AlertCircle,
} from 'lucide-react'
import type { AppPage } from '../types/navigation'
import type { HealthResponse } from '../types/safebox'

interface SidebarProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  onOpenConnections: () => void
  connectionCount: number
  health: HealthResponse | null
  healthError: string | null
}

interface NavButtonConfig {
  id: AppPage
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  onOpenConnections,
  connectionCount,
  health,
  healthError,
}) => {
  const navButtons: NavButtonConfig[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'test-lab', label: 'Test Lab', icon: FlaskConical },
    { id: 'workflow', label: 'Workflow', icon: Network },
    { id: 'runs', label: 'Run Explorer', icon: History },
    { id: 'details', label: 'Run Details', icon: FileSearch },
  ]

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-shield">
          <ShieldCheck className="sidebar-logo-icon" />
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">SafeBox AI</div>
          <div className="sidebar-brand-sub">DEFENSE PLATFORM</div>
        </div>
      </div>

      {/* Primary Navigation List */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-title">SECURITY SUITE</div>
        {navButtons.map((btn) => {
          const Icon = btn.icon
          const isActive = activePage === btn.id
          return (
            <button
              key={btn.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(btn.id)}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`nav-${btn.id}`}
              data-cursor-label={btn.label}
            >
              <div className="nav-icon-wrapper">
                <Icon className="sidebar-nav-icon" />
              </div>
              <span className="sidebar-nav-label">{btn.label}</span>
              {btn.badge && <span className="sidebar-nav-badge">{btn.badge}</span>}
              {isActive && <span className="active-indicator" />}
            </button>
          )
        })}

        <div className="sidebar-section-title mt-4">INFRASTRUCTURE</div>
        <button
          type="button"
          className="sidebar-nav-item"
          onClick={onOpenConnections}
          data-testid="nav-model-connections"
          data-cursor-label="Providers"
          title="Configure and manage saved inference providers and endpoints"
        >
          <div className="nav-icon-wrapper">
            <Server className="sidebar-nav-icon text-violet" />
          </div>
          <span className="sidebar-nav-label">Model Providers</span>
          <span className="sidebar-nav-count">{connectionCount}</span>
        </button>
      </nav>

      {/* Sidebar Footer / System Health */}
      <div className="sidebar-footer">
        <div className="sidebar-health-card">
          <div className="health-card-header">
            {healthError ? (
              <AlertCircle className="health-icon text-rose" />
            ) : (
              <Activity className="health-icon text-emerald" />
            )}
            <span className="health-status-text">
              {healthError ? 'API OFFLINE' : 'API LIVE'}
            </span>
          </div>
          <div className="health-card-details">
            <span className="detail-row">
              <span className="detail-key">Mode:</span>
              <strong className="detail-val font-mono">{health?.target_mode?.toUpperCase() || 'MOCK'}</strong>
            </span>
            <span className="detail-row">
              <span className="detail-key">SQLITE:</span>
              <strong className="detail-val font-mono">{health?.database_ok ? 'CONNECTED' : 'OFFLINE'}</strong>
            </span>
          </div>
        </div>

        <div className="sidebar-version-tag">
          <span>SafeBox v{health?.version || '1.0.0'}</span>
        </div>
      </div>
    </aside>
  )
}
