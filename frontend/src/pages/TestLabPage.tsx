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
  AlertOctagon,
  FlaskConical,
  Server,
  Layers,
  Activity,
} from 'lucide-react'
import { SafeBoxMagnet } from '../components/SafeBoxMagnet'
import { BentoCard } from '../components/MagicBento'

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
      {/* Top Test Lab Header / Verdict & Posture Card */}
      <div
        className={`card test-lab-hero-card ${
          lastLaunchedRun?.result?.status === 'FAIL' ? 'border-rose-subtle' : ''
        }`}
        data-testid="test-lab-hero"
      >
        <div className="test-lab-hero-summary">
          <div className="test-lab-hero-header">
            <div className="hero-icon-badge">
              {lastLaunchedRun ? (
                lastLaunchedRun.result?.status === 'FAIL' ? (
                  <ShieldAlert className="icon-sm text-rose" />
                ) : lastLaunchedRun.result?.status === 'ERROR' ? (
                  <AlertOctagon className="icon-sm text-amber" />
                ) : (
                  <ShieldCheck className="icon-sm text-emerald" />
                )
              ) : (
                <FlaskConical className="icon-sm text-cyan" />
              )}
            </div>
            <div className="hero-header-text">
              <div className="hero-run-title-row">
                <h3 className="hero-run-title">
                  {lastLaunchedRun
                    ? `Evaluation Completed · Run ${lastLaunchedRun.run_id.slice(0, 16)}...`
                    : 'Adversarial Test Lab Ready'}
                </h3>
                {lastLaunchedRun?.result?.status ? (
                  <span
                    className={`badge badge-sm font-mono ${
                      lastLaunchedRun.result.status === 'PASS'
                        ? 'badge-pass'
                        : lastLaunchedRun.result.status === 'FAIL'
                        ? 'badge-fail'
                        : 'badge-error'
                    }`}
                  >
                    {lastLaunchedRun.result.status === 'PASS'
                      ? 'PASS (Adhered)'
                      : lastLaunchedRun.result.status === 'FAIL'
                      ? 'FAIL (Policy Breach)'
                      : lastLaunchedRun.result.status}
                  </span>
                ) : (
                  <span className="badge badge-sm badge-pass font-mono">LAB READY</span>
                )}
              </div>
              <p className="hero-run-desc">
                {lastLaunchedRun
                  ? lastLaunchedRun.result?.explanation ||
                    `Evaluated target engine against ${lastLaunchedRun.test_id} security benchmark.`
                  : 'Configure multi-provider security benchmarks and adversarial attack vectors to test model compliance and Linux sandbox isolation.'}
              </p>
            </div>
          </div>

          <div className="test-lab-hero-actions">
            {lastLaunchedRun ? (
              <>
                <button
                  type="button"
                  className="btn-secondary btn-sm cursor-target"
                  onClick={() => onNavigate('workflow')}
                  data-cursor-label="Canvas"
                >
                  <Network className="icon-xs" />
                  <span>View in Workflow Canvas</span>
                </button>
                <SafeBoxMagnet maxDisplacement={5} range={75}>
                  <button
                    type="button"
                    className="btn-primary btn-sm cursor-target"
                    onClick={() => onNavigate('details')}
                    data-cursor-label="Report"
                  >
                    <FileSearch className="icon-xs" />
                    <span>View Full Report</span>
                  </button>
                </SafeBoxMagnet>
              </>
            ) : (
              <span className="text-xs text-muted font-mono">
                Select test benchmark and target profile below, then click Launch Security Test.
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Operational Telemetry & Benchmark Context */}
        <div className="test-lab-hero-telemetry">
          <div className="hero-telemetry-header">
            <span className="telemetry-header-label">
              {lastLaunchedRun ? 'Active Audit Telemetry' : 'Lab Readiness Posture'}
            </span>
            <span className="status-pill status-pill-ok">
              <span className="badge-pulse-dot" />
              <span>{isRunning ? 'RUNNING' : 'SYSTEM READY'}</span>
            </span>
          </div>

          <div className="hero-telemetry-grid">
            <div className="telemetry-tile">
              <span className="tile-label">BENCHMARK TEST</span>
              <strong className="tile-val font-mono">
                {lastLaunchedRun ? lastLaunchedRun.test_id : tests[0]?.test_id || 'canary-disclosure'}
              </strong>
              <span className="tile-sub">
                {lastLaunchedRun
                  ? `Version ${lastLaunchedRun.test_version}`
                  : `${tests.length} registered benchmarks`}
              </span>
            </div>

            <div className="telemetry-tile">
              <span className="tile-label">TARGET ENGINE</span>
              <strong className="tile-val font-mono">
                {lastLaunchedRun
                  ? lastLaunchedRun.target.mode === 'mock'
                    ? 'Mock Simulator'
                    : lastLaunchedRun.target.model || lastLaunchedRun.target.mode
                  : activeMode === 'mock'
                  ? 'Mock Simulator'
                  : activeMode.toUpperCase()}
              </strong>
              <span className="tile-sub">
                {lastLaunchedRun?.target?.mock_behavior
                  ? `Behavior: ${lastLaunchedRun.target.mock_behavior}`
                  : 'Deterministic simulation'}
              </span>
            </div>

            <div className="telemetry-tile">
              <span className="tile-label">DOCKER ISOLATION</span>
              <strong className="tile-val font-mono">
                {lastLaunchedRun?.infrastructure?.status === 'PASS'
                  ? '7/7 Probes Hardened'
                  : '7 Boundary Probes'}
              </strong>
              <span className="tile-sub">Member 2 Linux sandbox</span>
            </div>

            <div className="telemetry-tile">
              <span className="tile-label">EXECUTION MODE</span>
              <strong className="tile-val font-mono text-cyan">
                {lastLaunchedRun ? 'Synchronous Audit' : 'Dual-Plane Decoupled'}
              </strong>
              <span className="tile-sub">
                {lastLaunchedRun
                  ? `State: ${lastLaunchedRun.state}`
                  : `${connections.length} saved providers`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Test Launcher Grid with Balanced Columns */}
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
          <BentoCard glowColor="#38bdf8" spotlightRadius={260} className="test-lab-guide-card">
            <div className="guide-header">
              <div className="guide-header-title-group">
                <div className="guide-icon-badge">
                  <ShieldCheck className="guide-icon text-cyan" />
                </div>
                <div>
                  <h3 className="guide-title">Evaluation Architecture</h3>
                  <p className="guide-subtitle">Dual-Plane Decoupled Safety Engine</p>
                </div>
              </div>
              <span className="badge badge-sm badge-pass font-mono">DUAL-PLANE</span>
            </div>

            <div className="guide-sections">
              {/* Plane A: Behavioral Policy */}
              <div className="guide-plane-card plane-cyan">
                <div className="plane-header">
                  <div className="plane-tag-group">
                    <Activity className="icon-xs text-cyan" />
                    <span className="guide-tag tag-cyan font-mono">PLANE A: BEHAVIORAL POLICY</span>
                  </div>
                  <span className="plane-metric-pill">SYNCHRONOUS</span>
                </div>
                <p className="guide-text">
                  Synchronous prompt injection, canary extraction detection, and adversarial policy
                  compliance tested directly against model inference tokens.
                </p>
              </div>

              {/* Plane B: Docker Isolation */}
              <div className="guide-plane-card plane-violet">
                <div className="plane-header">
                  <div className="plane-tag-group">
                    <Layers className="icon-xs text-violet" />
                    <span className="guide-tag tag-violet font-mono">PLANE B: DOCKER ISOLATION</span>
                  </div>
                  <span className="plane-metric-pill">7/7 PROBES</span>
                </div>
                <p className="guide-text">
                  Hardened container sandbox verified via 7 independent Linux kernel boundary checks
                  (cgroups, non-root, socket absence, egress deny).
                </p>
              </div>

              {/* Stats Summary Panel */}
              <div className="guide-stats">
                <div className="guide-stat-row">
                  <div className="stat-name-group">
                    <Server className="icon-xs text-violet" />
                    <span className="stat-name">Model Providers</span>
                  </div>
                  <strong className="stat-val font-mono">{connections.length} configured</strong>
                </div>
                <div className="guide-stat-row">
                  <div className="stat-name-group">
                    <Layers className="icon-xs text-cyan" />
                    <span className="stat-name">Test Benchmarks</span>
                  </div>
                  <strong className="stat-val font-mono">{tests.length} registered</strong>
                </div>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  )
}

