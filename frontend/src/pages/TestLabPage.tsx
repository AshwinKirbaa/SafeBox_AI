import React from 'react'
import { TestLauncher } from '../components/TestLauncher'
import type {
  SecurityTestMeta,
  TargetMode,
  RunRequest,
  SavedConnection,
  RunRecord,
} from '../types/safebox'
import type { AppPage } from '../types/navigation'
import {
  Network,
  FileSearch,
  ShieldCheck,
  ShieldAlert,
  Server,
  Layers,
} from 'lucide-react'

interface TestLabPageProps {
  tests: SecurityTestMeta[]
  activeMode: TargetMode
  loadingTests: boolean
  isRunning: boolean
  connections: SavedConnection[]
  lastLaunchedRun: RunRecord | null
  onOpenConnections: () => void
  onRunTest: (req: RunRequest) => Promise<void>
  onNavigate: (page: AppPage) => void
}

export const TestLabPage: React.FC<TestLabPageProps> = ({
  tests,
  activeMode,
  loadingTests,
  isRunning,
  connections,
  lastLaunchedRun,
  onOpenConnections,
  onRunTest,
  onNavigate,
}) => {
  return (
    <div className="page-container test-lab-page">
      {/* Test Launch Verdict Notification with Direct Action CTAs */}
      {lastLaunchedRun && !isRunning && (
        <div className={`card test-launch-success-banner ${
          lastLaunchedRun.result?.status === 'FAIL' ? 'border-rose-subtle' : ''
        } mb-4`}>
          <div className="success-banner-left">
            <div className="success-icon-badge">
              {lastLaunchedRun.result?.status === 'FAIL' ? (
                <ShieldAlert className="icon-sm text-rose" />
              ) : (
                <ShieldCheck className="icon-sm text-emerald" />
              )}
            </div>
            <div>
              <h4 className="success-banner-title">
                Evaluation Completed &bull; Run <code>{lastLaunchedRun.run_id.slice(0, 16)}...</code>
              </h4>
              <p className="success-banner-desc">
                AI Safety Verdict:{' '}
                <strong className={`text-${(lastLaunchedRun.result?.status || 'missing').toLowerCase()}`}>
                  {lastLaunchedRun.result?.status === 'PASS'
                    ? 'PASS (Adhered)'
                    : lastLaunchedRun.result?.status === 'FAIL'
                    ? 'FAIL (Policy Breach)'
                    : lastLaunchedRun.result?.status || 'COMPLETED'}
                </strong>
                {' '}&bull; Target: {lastLaunchedRun.target.mode === 'mock' ? 'Mock Simulator' : lastLaunchedRun.target.model}
              </p>
            </div>
          </div>

          <div className="success-banner-actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => onNavigate('workflow')}
            >
              <Network className="icon-xs" />
              <span>View in Workflow Canvas</span>
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => onNavigate('details')}
            >
              <FileSearch className="icon-xs" />
              <span>View Full Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Test Launcher Grid with Sidebar Guidance */}
      <div className="test-lab-grid">
        <div className="test-lab-launcher-col">
          <TestLauncher
            tests={tests}
            activeMode={activeMode}
            loadingTests={loadingTests}
            isRunning={isRunning}
            connections={connections}
            onOpenConnections={onOpenConnections}
            onRunTest={onRunTest}
          />
        </div>

        <div className="test-lab-context-col">
          <div className="card test-lab-guide-card">
            <div className="guide-header">
              <ShieldCheck className="guide-icon text-cyan" />
              <div>
                <h4 className="guide-title">Evaluation Architecture</h4>
                <p className="guide-subtitle">Dual-Plane Decoupled Safety Engine</p>
              </div>
            </div>

            <div className="guide-sections">
              <div className="guide-item">
                <span className="guide-tag tag-cyan">PLANE A: BEHAVIORAL POLICY</span>
                <p className="guide-text">
                  Synchronous prompt injection, canary extraction detection, and adversarial policy compliance tested directly against model inference tokens.
                </p>
              </div>

              <div className="guide-item">
                <span className="guide-tag tag-violet">PLANE B: DOCKER ISOLATION</span>
                <p className="guide-text">
                  Hardened container sandbox verified via 7 independent Linux kernel boundary checks (cgroups, non-root, socket absence, egress deny).
                </p>
              </div>

              <div className="guide-stats">
                <div className="guide-stat-row">
                  <span className="stat-name">
                    <Server className="icon-xs text-violet inline mr-1" /> Model Providers:
                  </span>
                  <strong className="stat-val font-mono">{connections.length} configured</strong>
                </div>
                <div className="guide-stat-row">
                  <span className="stat-name">
                    <Layers className="icon-xs text-cyan inline mr-1" /> Test Benchmarks:
                  </span>
                  <strong className="stat-val font-mono">{tests.length} registered</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary btn-sm w-full mt-3"
                onClick={onOpenConnections}
              >
                <Server className="icon-xs" />
                <span>Manage Model Connections</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
