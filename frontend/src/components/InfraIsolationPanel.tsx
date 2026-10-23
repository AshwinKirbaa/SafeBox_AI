import React, { useState } from 'react'
import {
  Server,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Clock,
  Terminal,
  Copy,
  Check,
  HardDrive,
  UserCheck,
  Lock,
  Cpu,
  Layers,
  FolderMinus,
  Globe,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { BentoCard } from './MagicBento'
import { api } from '../services/api'
import type { InfrastructureSummary, InfraCheckResult } from '../types/safebox'

export type InfraVerificationState = 'NOT_VERIFIED' | 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR'

interface InfraIsolationPanelProps {
  infrastructure: InfrastructureSummary
  runId: string
  onRefreshRun?: (runId: string) => Promise<void> | void
}

// All 7 standard Member 2 isolation check definitions
interface CheckDefinition {
  id: string
  name: string
  policy: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}

const STANDARD_CHECKS: CheckDefinition[] = [
  {
    id: 'docker-socket-absence',
    name: 'Docker Socket Absence',
    policy: 'no-docker-socket',
    icon: HardDrive,
    desc: 'Verifies /var/run/docker.sock and container daemon sockets are completely unmounted and inaccessible.',
  },
  {
    id: 'non-root-execution',
    name: 'Non-Root Process Execution',
    policy: 'non-root-user',
    icon: UserCheck,
    desc: 'Verifies the worker container runs under unprivileged UID/GID (10001:10001), never root.',
  },
  {
    id: 'dropped-capabilities',
    name: 'Dropped Linux Capabilities',
    policy: 'cap-drop-all',
    icon: Lock,
    desc: 'Inspects /proc/self/status ensuring CapEff=0x0 (--cap-drop=ALL, no raw sockets or admin caps).',
  },
  {
    id: 'resource-limits',
    name: 'Cgroups Resource Constraints',
    policy: 'bounded-cgroup-resources',
    icon: Cpu,
    desc: 'Inspects cgroup v2 bounds: enforces memory limits (<=256m) and PID fork limits (<=64).',
  },
  {
    id: 'workspace-isolation',
    name: 'Workspace Boundary Separation',
    policy: 'per-run-workspace-separation',
    icon: Layers,
    desc: 'Probes cross-run directories: confirms worker can only access designated ephemeral run volume.',
  },
  {
    id: 'host-filesystem-protection',
    name: 'Host Filesystem Protection',
    policy: 'no-prohibited-host-mounts',
    icon: FolderMinus,
    desc: 'Probes host paths (/etc/shadow, host root, docker pipes): ensures root filesystem is read-only tmpfs.',
  },
  {
    id: 'network-egress',
    name: 'Network Egress Isolation',
    policy: 'egress-deny-all',
    icon: Globe,
    desc: 'Probes TCP socket connections to external IPs: confirms complete network isolation (--network=none).',
  },
]

export const InfraIsolationPanel: React.FC<InfraIsolationPanelProps> = ({
  infrastructure,
  runId,
  onRefreshRun,
}) => {
  const [copied, setCopied] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)

  const submittedMap = new Map<string, InfraCheckResult>()
  if (infrastructure?.checks) {
    infrastructure.checks.forEach((c) => submittedMap.set(c.check_id, c))
  }

  // Explicit state machine: NOT_VERIFIED, RUNNING, PASS, FAIL, ERROR
  let state: InfraVerificationState
  if (isLaunching || infrastructure.status === 'PENDING') {
    state = 'RUNNING'
  } else if (infrastructure.status === 'PASS') {
    // PASS is only shown when persisted by backend for this exact run
    state = 'PASS'
  } else if (infrastructure.status === 'FAIL') {
    state = 'FAIL'
  } else if (infrastructure.status === 'ERROR' || infrastructure.status === 'UNAVAILABLE') {
    state = 'ERROR'
  } else if (executionError) {
    state = 'ERROR'
  } else {
    state = 'NOT_VERIFIED'
  }

  const isMissing = state === 'NOT_VERIFIED'
  const isPass = state === 'PASS'
  const isFail = state === 'FAIL'
  const isError = state === 'ERROR'
  const isRunning = state === 'RUNNING'

  const workerCmd = `powershell -ExecutionPolicy Bypass -File worker/run_worker.ps1 -RunId ${runId}`

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(workerCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLaunchWorker = async (allowHostFallback = false) => {
    if (isLaunching || state === 'RUNNING') return
    setIsLaunching(true)
    setExecutionError(null)

    try {
      await api.launchWorker(runId, allowHostFallback)
      if (onRefreshRun) {
        await onRefreshRun(runId)
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Worker execution failed.'
      setExecutionError(msg)
    } finally {
      setIsLaunching(false)
    }
  }

  const handleSync = async () => {
    if (isSyncing || !onRefreshRun) return
    setIsSyncing(true)
    try {
      await onRefreshRun(runId)
    } finally {
      setIsSyncing(false)
    }
  }

  // Derive actionable troubleshooting notes for specific error classes
  let actionableTroubleshooting: string | null = null
  let isDockerError = false
  if (executionError) {
    const lower = executionError.toLowerCase()
    if (lower.includes('docker') || lower.includes('daemon')) {
      isDockerError = true
      actionableTroubleshooting =
        'Docker Desktop daemon is stopped or unreachable. Ensure Docker Desktop is running with the Linux container engine, or run the local diagnostic check below.'
    } else if (lower.includes('token') || lower.includes('worker_auth')) {
      actionableTroubleshooting =
        'Worker authentication token is missing or rejected. Ensure SAFEBOX_WORKER_TOKEN is configured in backend/.env.'
    } else if (lower.includes('not found') || lower.includes('404')) {
      actionableTroubleshooting =
        `Security test run '${runId}' was not found on the backend. Please select a valid run record.`
    } else if (lower.includes('already_running') || lower.includes('409')) {
      actionableTroubleshooting =
        'Container sandbox verification is already in progress for this run. Wait for completion or sync status.'
    } else if (lower.includes('failed to fetch') || lower.includes('connection refused')) {
      actionableTroubleshooting =
        'Cannot connect to the SafeBox backend at http://127.0.0.1:8000. Please verify the backend is running.'
    }
  }

  return (
    <BentoCard
      glowColor="#c084fc"
      spotlightRadius={280}
      className={`panel-container infra-panel border-${state.toLowerCase()}`}
      data-testid="infra-isolation-panel"
    >
      {/* Panel Top Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <Server className="panel-title-icon text-violet" />
          <div>
            <h3>Infrastructure Isolation Verification</h3>
            <p className="panel-subtitle">Member 2 Hardened Docker Sandbox</p>
          </div>
        </div>
        <div className="panel-header-actions">
          <span className="badge badge-sm font-mono mr-2" data-testid="infra-progress-badge">
            {submittedMap.size} of 7 checks submitted
          </span>
          {onRefreshRun && (
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={handleSync}
              disabled={isSyncing || isLaunching}
              title="Sync infrastructure check results"
              data-testid="btn-header-sync"
            >
              <RefreshCw className={`icon-xs ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <StatusBadge
            status={state === 'NOT_VERIFIED' ? 'MISSING' : state}
            type="infra"
            size="lg"
          />
        </div>
      </div>

      {/* Aggregate Status Banner */}
      <div className={`verdict-banner banner-${state.toLowerCase()}`}>
        <div className="verdict-banner-header">
          {isPass && <ShieldCheck className="verdict-icon text-emerald" />}
          {isFail && <ShieldAlert className="verdict-icon text-rose" />}
          {isError && <AlertTriangle className="verdict-icon text-amber" />}
          {isRunning && <Clock className="verdict-icon text-blue animate-pulse" />}
          {isMissing && <HelpCircle className="verdict-icon text-slate" />}

          <div>
            <h4 className="verdict-title">
              {isPass && 'Verified Container Isolation (All 7 Probes Passed)'}
              {isFail && 'Isolation Boundary Violation Detected'}
              {isError && (infrastructure.status === 'UNAVAILABLE' ? 'Container Isolation Unavailable on Host' : 'Worker Execution Error Reported')}
              {isRunning && 'Sandbox Verification In Progress'}
              {isMissing && 'Not Verified (No Worker Checks Submitted Yet)'}
            </h4>
            <p className="verdict-explanation">
              {infrastructure.note ||
                (isMissing
                  ? 'Awaiting sandbox worker execution. Next action: Launch worker below to probe the 7 container security boundaries.'
                  : 'Reported independently by the sandbox worker. Evaluator never substitutes for this status.')}
            </p>
          </div>
        </div>
      </div>

      {/* Running State Notice */}
      {isRunning && (
        <div className="worker-running-notice" data-testid="worker-running-notice">
          <Loader2 className="spinner-medium text-cyan animate-spin" />
          <div>
            <p className="font-semibold text-cyan">Executing Member 2 Hardened Container Sandbox...</p>
            <p className="text-xs text-muted">Probing all 7 isolation boundaries. Refreshing run record automatically.</p>
          </div>
        </div>
      )}

      {/* Actionable Error Banner if an execution error occurred */}
      {executionError && (
        <div
          className="alert-banner alert-error runner-error-banner"
          role="alert"
          data-testid="worker-execution-error"
        >
          <div className="alert-content">
            <AlertCircle className="alert-icon" />
            <div>
              <strong>Execution Error:</strong> {executionError}
              {actionableTroubleshooting && (
                <p className="text-xs mt-1 text-dim">{actionableTroubleshooting}</p>
              )}
            </div>
          </div>
          {isDockerError && (
            <button
              type="button"
              className="btn-secondary btn-xs mt-2"
              onClick={() => handleLaunchWorker(true)}
              disabled={isLaunching}
              data-testid="btn-launch-fallback"
            >
              Run Host Check (Diagnostic Fallback)
            </button>
          )}
        </div>
      )}

      {/* When unverified or error: Display Worker Launch action & copyable command */}
      {(isMissing || isError) && (
        <div className="worker-runner-box" data-testid="worker-runner-box">
          <div className="runner-box-header">
            <Terminal className="terminal-icon" />
            <span>Launch Member 2 Container Sandbox Verification</span>
          </div>
          <p className="runner-box-desc">
            The AI model safety evaluation has completed, but the hardened Linux container worker
            has not yet attached isolation checks to this run record. Launch the verification or run manually:
          </p>

          <div className="runner-action-row">
            <button
              type="button"
              className="btn-primary btn-launch-worker"
              onClick={() => handleLaunchWorker(false)}
              disabled={isLaunching || state === 'RUNNING'}
              data-testid="btn-launch-worker"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="btn-icon animate-spin" />
                  <span>Verifying Isolation...</span>
                </>
              ) : (
                <>
                  <Play className="btn-icon" />
                  <span>Launch Worker Verification</span>
                </>
              )}
            </button>

            {onRefreshRun && (
              <button
                type="button"
                className="btn-secondary btn-sync-worker"
                onClick={handleSync}
                disabled={isSyncing || isLaunching}
                title="Poll backend for updated worker submissions"
                data-testid="btn-sync-worker"
              >
                <RefreshCw className={`btn-icon ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Status</span>
              </button>
            )}
          </div>

          <div className="code-clip-row">
            <code className="code-snippet">{workerCmd}</code>
            <button
              className="btn-copy"
              onClick={handleCopyCmd}
              title="Copy worker runner command"
            >
              {copied ? (
                <>
                  <Check className="copy-icon text-emerald" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="copy-icon" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* All Seven Infrastructure Checks Grid */}
      <div className="infra-checks-section">
        <div className="section-title-row">
          <h4>Seven Standard Infrastructure Boundaries</h4>
          <span className="text-xs text-muted">
            {submittedMap.size} of 7 checks submitted
          </span>
        </div>

        <div className="checks-list">
          {STANDARD_CHECKS.map((def) => {
            const check = submittedMap.get(def.id)
            const Icon = def.icon

            const checkStatus = check ? check.status : 'MISSING'

            return (
              <div
                key={def.id}
                className={`check-card check-card-${checkStatus.toLowerCase()}`}
                data-testid={`infra-check-${def.id}`}
              >
                <div className="check-card-header">
                  <div className="check-icon-title">
                    <Icon className="check-icon" />
                    <div>
                      <h5 className="check-name">{def.name}</h5>
                      <span className="check-id-tag">
                        <code>{def.id}</code> (policy: {check?.policy_id || def.policy})
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={checkStatus} type="infra" size="sm" />
                </div>

                <p className="check-description">{def.desc}</p>

                {check ? (
                  <div className="check-data-grid">
                    <div className="data-row">
                      <span className="data-key">Observed:</span>
                      <span className="data-val text-observed">
                        {check.observed || (check.error ? `Error: ${check.error}` : 'N/A')}
                      </span>
                    </div>

                    <div className="data-row">
                      <span className="data-key">Expected:</span>
                      <span className="data-val text-expected">
                        {check.expected || 'Enforced isolation policy'}
                      </span>
                    </div>

                    {check.evidence_ref && (
                      <div className="data-row">
                        <span className="data-key">Evidence:</span>
                        <code className="data-val text-ref">{check.evidence_ref}</code>
                      </div>
                    )}

                    {check.limitation && (
                      <div className="data-row data-row-limitation">
                        <span className="data-key">Limitation:</span>
                        <span className="data-val text-limitation">{check.limitation}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="check-unsubmitted">
                    <span className="unsubmitted-text">
                      No result submitted for this boundary yet.
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </BentoCard>
  )
}
