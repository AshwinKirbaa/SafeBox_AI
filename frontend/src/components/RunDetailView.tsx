import React, { useState } from 'react'
import {
  Copy,
  Check,
  Calendar,
  Layers,
  ArrowRightLeft,
  Cpu,
  Cloud,
} from 'lucide-react'
import type { RunRecord } from '../types/safebox'
import { AiEvaluationPanel } from './AiEvaluationPanel'
import { InfraIsolationPanel } from './InfraIsolationPanel'

interface RunDetailViewProps {
  run: RunRecord | null
  loading: boolean
}

export const RunDetailView: React.FC<RunDetailViewProps> = ({ run, loading }) => {
  const [copiedId, setCopiedId] = useState(false)

  if (loading && !run) {
    return (
      <div className="card detail-placeholder-card">
        <div className="spinner-large" />
        <p>Loading security audit record...</p>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="card detail-placeholder-card">
        <Layers className="empty-icon text-muted" />
        <h3>No Security Run Selected</h3>
        <p className="text-muted">
          Select a run from the history below or launch a new security evaluation.
        </p>
      </div>
    )
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(run.run_id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const isMockRun =
    run.target.mode === 'mock' ||
    run.target.provider === 'mock' ||
    run.target.adapter === 'mock' ||
    (typeof run.target.model === 'string' && run.target.model.startsWith('mock-'))

  const isOllamaRun = !isMockRun && (run.target.mode === 'ollama' || run.target.provider === 'ollama')

  let targetLabel = 'MOCK SIMULATOR'
  if (isMockRun) {
    targetLabel = 'MOCK SIMULATOR'
  } else if (isOllamaRun) {
    targetLabel = `OLLAMA · ${run.target.model || 'llama3.2:3b'}`
  } else {
    const prov = (run.target.provider || run.target.mode).toUpperCase()
    targetLabel = `${prov} · ${run.target.model}`
  }

  const tokenUsage = run.result?.token_usage
  const latency = run.result?.observed_latency_ms

  return (
    <div className="run-detail-wrapper" data-testid="run-detail-view">
      {/* Run Summary Top Bar */}
      <div className="run-meta-bar">
        <div className="meta-bar-left">
          <div className="run-id-badge-group">
            <span className="run-id-label">ACTIVE AUDIT RUN:</span>
            <code className="run-id-code">{run.run_id}</code>
            <button
              className="btn-copy-mini"
              onClick={handleCopyId}
              title="Copy Run ID"
            >
              {copiedId ? (
                <Check className="copy-icon text-emerald" />
              ) : (
                <Copy className="copy-icon" />
              )}
            </button>
            <span
              className={`target-run-badge ${isOllamaRun ? 'badge-target-ollama' : isMockRun ? 'badge-target-mock' : 'badge-target-remote'}`}
              data-testid="active-run-target-badge"
            >
              {targetLabel}
            </span>
          </div>

          <div className="run-details-chips">
            <span className="chip">
              Test: <strong>{run.test_id}</strong> (v{run.test_version})
            </span>
            <span className="chip" data-testid="active-run-target-chip">
              Target:{' '}
              <strong className={isOllamaRun ? 'text-cyan' : isMockRun ? 'text-amber' : 'text-purple'}>
                {targetLabel}
              </strong>
              {isMockRun && (
                <span className="text-xs text-amber font-mono ml-1">[Simulated Mock]</span>
              )}
              {!isMockRun && (
                <span className="text-xs text-cyan font-mono ml-1">[Live Model]</span>
              )}
              {isMockRun && run.target.mock_behavior && (
                <span className="text-xs text-muted"> ({run.target.mock_behavior})</span>
              )}
            </span>
            {tokenUsage && tokenUsage.total_tokens !== null && tokenUsage.total_tokens !== undefined && (
              <span className="chip chip-tokens">
                <Cpu className="chip-icon" />
                Tokens: <strong>{tokenUsage.total_tokens}</strong>
                {tokenUsage.prompt_tokens !== null && tokenUsage.completion_tokens !== null && (
                  <span className="text-xs text-muted ml-1">
                    ({tokenUsage.prompt_tokens} in / {tokenUsage.completion_tokens} out)
                  </span>
                )}
              </span>
            )}
            {latency !== null && latency !== undefined && (
              <span className="chip">
                Latency: <strong>{latency}ms</strong>
              </span>
            )}
            <span className="chip chip-time">
              <Calendar className="chip-icon" />
              {new Date(run.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="meta-bar-right">
          <span className={`state-badge state-${run.state.toLowerCase()}`}>
            {run.state}
          </span>
        </div>
      </div>

      {/* Dual Independence Callout */}
      <div className="independence-explainer-banner">
        <div className="explainer-header">
          <ArrowRightLeft className="explainer-icon text-cyan" />
          <span className="explainer-title">
            Independent Security Planes Architecture
          </span>
        </div>
        <p className="explainer-text">
          SafeBox decouples <strong>AI behavioral compliance</strong> (evaluated against prompt policies) from{' '}
          <strong>infrastructure isolation</strong> (evaluated inside hardened Linux containers).
          A failure in one plane never alters or invalidates verification in the other.
        </p>
        {run.target.is_remote && (
          <div className="remote-notice-callout mt-2">
            <Cloud className="icon-xs text-cyan mr-1" />
            <span className="text-xs">
              <strong>Remote Cloud Execution:</strong> Local Docker isolation verifies the SafeBox testing worker container, not the external cloud provider's internal infrastructure.
            </span>
          </div>
        )}
      </div>

      {/* Two Independent Result Panels Grid */}
      <div className="independent-panels-grid">
        {/* Panel 1: AI Safety Evaluation */}
        <AiEvaluationPanel
          result={run.result}
          evidence={run.evidence}
        />

        {/* Panel 2: Infrastructure Isolation */}
        <InfraIsolationPanel
          infrastructure={run.infrastructure}
          runId={run.run_id}
        />
      </div>
    </div>
  )
}
