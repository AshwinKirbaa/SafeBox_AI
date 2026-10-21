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
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { InfrastructureSummary, InfraCheckResult } from '../types/safebox'

interface InfraIsolationPanelProps {
  infrastructure: InfrastructureSummary
  runId: string
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
}) => {
  const [copied, setCopied] = useState(false)
  const submittedMap = new Map<string, InfraCheckResult>()
  if (infrastructure?.checks) {
    infrastructure.checks.forEach((c) => submittedMap.set(c.check_id, c))
  }

  const workerCmd = `powershell -ExecutionPolicy Bypass -File worker/run_worker.ps1 -RunId ${runId}`

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(workerCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isMissing = infrastructure.status === 'MISSING'
  const isPass = infrastructure.status === 'PASS'
  const isFail = infrastructure.status === 'FAIL'
  const isUnavailable = infrastructure.status === 'UNAVAILABLE'
  const isError = infrastructure.status === 'ERROR'
  const isPending = infrastructure.status === 'PENDING'

  return (
    <div
      className={`panel-container infra-panel border-${infrastructure.status.toLowerCase()}`}
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
        <StatusBadge status={infrastructure.status} type="infra" size="lg" />
      </div>

      {/* Aggregate Status Banner */}
      <div className={`verdict-banner banner-${infrastructure.status.toLowerCase()}`}>
        <div className="verdict-banner-header">
          {isPass && <ShieldCheck className="verdict-icon text-emerald" />}
          {isFail && <ShieldAlert className="verdict-icon text-rose" />}
          {isError && <AlertTriangle className="verdict-icon text-amber" />}
          {isUnavailable && <AlertTriangle className="verdict-icon text-amber" />}
          {isPending && <Clock className="verdict-icon text-blue" />}
          {isMissing && <HelpCircle className="verdict-icon text-slate" />}

          <div>
            <h4 className="verdict-title">
              {isPass && 'Verified Container Isolation (All Probes Passed)'}
              {isFail && 'Isolation Boundary Violation Detected'}
              {isError && 'Worker Execution Error Reported'}
              {isUnavailable && 'Container Isolation Unavailable on Host'}
              {isPending && 'Sandbox Verification In Progress'}
              {isMissing && 'Not Verified (No Worker Checks Submitted Yet)'}
            </h4>
            <p className="verdict-explanation">
              {infrastructure.note ||
                'Reported independently by the sandbox worker. Evaluator never substitutes for this status.'}
            </p>
          </div>
        </div>
      </div>

      {/* When checks are MISSING: Display command to run worker */}
      {isMissing && (
        <div className="worker-runner-box">
          <div className="runner-box-header">
            <Terminal className="terminal-icon" />
            <span>Launch Member 2 Container Sandbox Verification</span>
          </div>
          <p className="runner-box-desc">
            The AI model safety evaluation has completed, but the hardened Linux container worker
            has not yet attached isolation checks to this run record. Run the worker script to verify:
          </p>
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
    </div>
  )
}
