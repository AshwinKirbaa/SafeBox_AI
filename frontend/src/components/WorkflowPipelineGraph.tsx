import React from 'react'
import {
  Brain,
  Server,
  HardDrive,
  UserCheck,
  Lock,
  Cpu,
  Layers,
  FolderMinus,
  Globe,
  ArrowRight,
  Split,
} from 'lucide-react'
import type { RunRecord, InfraCheckResult, InfraStatus, AiTestStatus } from '../types/safebox'

interface WorkflowPipelineGraphProps {
  run: RunRecord | null
  loading: boolean
  selectedRunId?: string | null
}

const PROBE_NODES = [
  { id: 'docker-socket-absence', name: 'Socket', icon: HardDrive },
  { id: 'non-root-execution', name: 'Non-Root', icon: UserCheck },
  { id: 'dropped-capabilities', name: 'Caps Drop', icon: Lock },
  { id: 'resource-limits', name: 'Cgroups', icon: Cpu },
  { id: 'workspace-isolation', name: 'Workspace', icon: Layers },
  { id: 'host-filesystem-protection', name: 'Host FS', icon: FolderMinus },
  { id: 'network-egress', name: 'Egress', icon: Globe },
]

export const WorkflowPipelineGraph: React.FC<WorkflowPipelineGraphProps> = ({
  run,
  loading,
  selectedRunId: _selectedRunId,
}) => {
  if (!run && !loading) {
    return null
  }

  const aiStatus: AiTestStatus | null = run?.result?.status || null
  const infraStatus: InfraStatus = run?.infrastructure?.status || 'MISSING'
  const isRunningAi = loading || run?.state === 'RUNNING'
  const isRunningInfra = infraStatus === 'PENDING'

  // Map submitted checks
  const checkMap = new Map<string, InfraCheckResult>()
  if (run?.infrastructure?.checks) {
    run.infrastructure.checks.forEach((c) => checkMap.set(c.check_id, c))
  }

  const isMock =
    !run?.target.provider ||
    run.target.provider === 'mock' ||
    run.target.mode === 'mock'

  const targetLabel = isMock
    ? 'MOCK SIMULATOR'
    : run?.target.model || run?.target.provider?.toUpperCase() || 'LIVE MODEL'

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'PASS':
        return 'node-status-pass'
      case 'FAIL':
        return 'node-status-fail'
      case 'ERROR':
      case 'UNAVAILABLE':
        return 'node-status-error'
      case 'UNSUPPORTED':
        return 'node-status-unsupported'
      case 'INCONCLUSIVE':
        return 'node-status-inconclusive'
      case 'PENDING':
        return 'node-status-pending'
      default:
        return 'node-status-missing'
    }
  }

  return (
    <div className="pipeline-graph-card" data-testid="workflow-pipeline-graph">
      {/* Topology Header */}
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Split className="pipeline-icon text-cyan" />
          <div>
            <h4 className="pipeline-title">Independent Dual-Plane Security Topology</h4>
            <p className="pipeline-subtitle">
              Synchronous Behavioral Policy Evaluation decoupled from Member 2 Hardened Sandbox Isolation
            </p>
          </div>
        </div>
        <div className="pipeline-meta-chips">
          <span className="pipeline-chip">
            <span className="chip-led led-cyan" />
            Decoupled Planes
          </span>
          {run && (
            <span className="pipeline-chip font-mono">
              Run: {run.run_id.slice(0, 12)}...
            </span>
          )}
        </div>
      </div>

      {/* Interactive Visual Graph Canvas */}
      <div className="pipeline-canvas">
        {/* Step 1: Origin Test Node */}
        <div className={`pipeline-node node-origin ${isRunningAi ? 'node-pulse-cyan' : ''}`}>
          <div className="node-badge">STAGE 01 &bull; TEST ORIGIN</div>
          <div className="node-body">
            <div className="node-icon-box origin-icon-box">
              <span className="node-icon-dot" />
              <Cpu className="node-main-icon text-cyan" />
            </div>
            <div className="node-content">
              <span className="node-title font-mono">{run?.test_id || 'Security Test'}</span>
              <span className="node-desc text-muted">
                Target: <strong className={isMock ? 'text-amber' : 'text-cyan'}>{targetLabel}</strong>
              </span>
            </div>
          </div>
          <div className="node-footer font-mono">
            <span>State: {run?.state || (loading ? 'RUNNING' : 'IDLE')}</span>
          </div>
        </div>

        {/* Junction Connector */}
        <div className="pipeline-connector-junction">
          <svg className="connector-svg" preserveAspectRatio="none" viewBox="0 0 80 180">
            <path
              d="M 0 90 C 40 90, 40 45, 80 45"
              fill="none"
              className={`connector-path ${isRunningAi ? 'path-active-cyan' : 'path-static'}`}
            />
            <path
              d="M 0 90 C 40 90, 40 135, 80 135"
              fill="none"
              className={`connector-path ${isRunningInfra ? 'path-active-violet' : 'path-static'}`}
            />
            <circle cx="0" cy="90" r="4" className="junction-hub-dot" />
          </svg>
          <div className="junction-label">
            <ArrowRight className="junction-arrow" />
          </div>
        </div>

        {/* Dual Stream Branches */}
        <div className="pipeline-branches-col">
          {/* Branch A: Member 1 AI Evaluation */}
          <div className={`branch-card branch-ai ${getStatusColor(aiStatus)}`}>
            <div className="branch-header">
              <div className="branch-id">
                <Brain className="branch-icon text-cyan" />
                <span>PLANE A &bull; MEMBER 1 BEHAVIORAL POLICY</span>
              </div>
              <span className={`branch-badge badge-${(aiStatus || 'pending').toLowerCase()}`}>
                {aiStatus ? `AI: ${aiStatus}` : isRunningAi ? 'EVALUATING...' : 'PENDING'}
              </span>
            </div>

            <div className="branch-flow-row">
              <div className="flow-step">
                <span className="step-label">Input / Canary Policy</span>
                <span className="step-val font-mono">{run?.test_version ? `v${run.test_version}` : '1.0.0'}</span>
              </div>
              <span className="flow-arrow">&rarr;</span>
              <div className="flow-step">
                <span className="step-label">Rule Inspection</span>
                <span className="step-val font-mono">{run?.result?.rule_id || 'Deterministic Rule'}</span>
              </div>
              <span className="flow-arrow">&rarr;</span>
              <div className="flow-step">
                <span className="step-label">Verdict & Evidence</span>
                <span className="step-val">
                  {aiStatus === 'PASS' && <span className="text-emerald font-semibold">&bull; PASS (Adhered)</span>}
                  {aiStatus === 'FAIL' && <span className="text-rose font-semibold">&bull; FAIL (Breached)</span>}
                  {aiStatus === 'ERROR' && <span className="text-amber font-semibold">&bull; ERROR (Failed)</span>}
                  {aiStatus === 'INCONCLUSIVE' && <span className="text-muted font-semibold">&bull; INCONCLUSIVE</span>}
                  {aiStatus === 'UNSUPPORTED' && <span className="text-violet font-semibold">&bull; UNSUPPORTED</span>}
                  {!aiStatus && <span className="text-dim">&bull; Awaiting inference</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Branch B: Member 2 Infrastructure Isolation */}
          <div className={`branch-card branch-infra ${getStatusColor(infraStatus)}`}>
            <div className="branch-header">
              <div className="branch-id">
                <Server className="branch-icon text-violet" />
                <span>PLANE B &bull; MEMBER 2 HARDENED CONTAINER SANDBOX</span>
              </div>
              <span className={`branch-badge badge-${infraStatus.toLowerCase()}`}>
                {infraStatus === 'PASS'
                  ? 'ISOLATION PASS (7/7)'
                  : infraStatus === 'FAIL'
                  ? 'ISOLATION BREACH'
                  : infraStatus === 'PENDING'
                  ? 'PROBING...'
                  : 'UNVERIFIED (MISSING)'}
              </span>
            </div>

            {/* 7 Check Probes Sub-graph Matrix */}
            <div className="probes-subgraph-matrix">
              {PROBE_NODES.map((probe) => {
                const submission = checkMap.get(probe.id)
                const probeStatus = submission ? submission.status : 'MISSING'
                const IconComponent = probe.icon

                return (
                  <div
                    key={probe.id}
                    className={`probe-node-item probe-${probeStatus.toLowerCase()}`}
                    title={`${probe.name}: ${submission ? submission.observed : 'Unverified / not submitted yet'}`}
                  >
                    <div className="probe-icon-wrapper">
                      <IconComponent className="probe-icon" />
                      <span className={`probe-led led-${probeStatus.toLowerCase()}`} />
                    </div>
                    <span className="probe-name">{probe.name}</span>
                    <span className="probe-status font-mono">
                      {probeStatus === 'PASS' ? 'PASS' : probeStatus === 'FAIL' ? 'FAIL' : 'MISSING'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
