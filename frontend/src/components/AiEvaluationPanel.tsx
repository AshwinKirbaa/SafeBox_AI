import React from 'react'
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Tag,
  AlertCircle,
  Repeat,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { EvidenceList } from './EvidenceList'
import { BentoCard } from './MagicBento'
import type { EvaluationResult, EvidenceItem } from '../types/safebox'

interface AiEvaluationPanelProps {
  result: EvaluationResult | null
  evidence: EvidenceItem[]
}

export const AiEvaluationPanel: React.FC<AiEvaluationPanelProps> = ({
  result,
  evidence,
}) => {
  if (!result) {
    return (
      <BentoCard glowColor="#38bdf8" spotlightRadius={280} className="panel-container ai-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <Brain className="panel-title-icon text-cyan" />
            <div>
              <h3>AI Behavioral Safety Evaluation</h3>
              <p className="panel-subtitle">Member 1 Evaluation Pipeline</p>
            </div>
          </div>
          <StatusBadge status={null} type="ai" />
        </div>
        <div className="panel-empty-state">
          <HelpCircle className="empty-icon" />
          <p>No AI evaluation verdict available for this run state.</p>
        </div>
      </BentoCard>
    )
  }

  const isPass = result.status === 'PASS'
  const isFail = result.status === 'FAIL'
  const isError = result.status === 'ERROR'
  const isInconclusive = result.status === 'INCONCLUSIVE'

  return (
    <BentoCard
      glowColor="#38bdf8"
      spotlightRadius={280}
      className={`panel-container ai-panel border-${result.status.toLowerCase()}`}
    >
      {/* Panel Top Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <Brain className="panel-title-icon text-cyan" />
          <div>
            <h3>AI Behavioral Safety Evaluation</h3>
            <p className="panel-subtitle">
              Rule: <code>{result.rule_id} v{result.rule_version}</code>
            </p>
          </div>
        </div>
        <StatusBadge status={result.status} type="ai" size="lg" />
      </div>

      {/* Primary Verdict Banner */}
      <div className={`verdict-banner banner-${result.status.toLowerCase()}`}>
        <div className="verdict-banner-header">
          {isPass && <ShieldCheck className="verdict-icon text-emerald" />}
          {isFail && <ShieldAlert className="verdict-icon text-rose" />}
          {isError && <AlertCircle className="verdict-icon text-amber" />}
          {isInconclusive && <HelpCircle className="verdict-icon text-slate" />}

          <div>
            <h4 className="verdict-title">
              {isPass && 'Model Adhered to Stated Safety Policy'}
              {isFail && 'Model Violated Configured Security Policy'}
              {isError && 'Execution Failed During Evaluation'}
              {isInconclusive && 'Inconclusive Behavioral Evidence'}
            </h4>
            <p className="verdict-explanation">{result.explanation}</p>
          </div>
        </div>

        {/* Matched Indicators */}
        {result.matched_indicators && result.matched_indicators.length > 0 && (
          <div className="indicators-row">
            <span className="indicators-label">
              <Tag className="tag-icon" />
              Indicators:
            </span>
            <div className="indicator-tags">
              {result.matched_indicators.map((ind, i) => (
                <span key={i} className="indicator-pill">
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Repeatability Agreement Summary (if applicable) */}
      {result.repeatability && (
        <div className="repeatability-box">
          <div className="repeatability-header">
            <div className="repeat-title">
              <Repeat className="repeat-icon" />
              <h4>
                Repeatability Test Results ({result.repeatability.executions} Executions)
              </h4>
            </div>
            <span
              className={`agreement-pill ${
                result.repeatability.agree ? 'agree-true' : 'agree-false'
              }`}
            >
              {result.repeatability.agree ? 'CONSISTENT (100%)' : 'DISAGREEMENT (FLAKY)'}
            </span>
          </div>

          <div className="outcomes-grid">
            {result.repeatability.outcomes.map((out) => (
              <div key={out.index} className={`outcome-item outcome-${out.status.toLowerCase()}`}>
                <span className="outcome-index">Run #{out.index + 1}</span>
                {out.status === 'PASS' ? (
                  <CheckCircle2 className="outcome-icon text-emerald" />
                ) : (
                  <XCircle className="outcome-icon text-rose" />
                )}
                <span className="outcome-status">{out.status}</span>
              </div>
            ))}
          </div>
          <p className="repeatability-note">
            Rate of agreement: <strong>{(result.repeatability.agreement_rate * 100).toFixed(1)}%</strong>.
            Agreement across trials demonstrates empirical consistency, not proof of determinism.
          </p>
        </div>
      )}

      {/* Stated Test Limitations */}
      {result.limitations && result.limitations.length > 0 && (
        <div className="limitations-callout">
          <div className="limitations-callout-header">
            <AlertTriangle className="limit-icon" />
            <span>Benchmark Limitations & Scope</span>
          </div>
          <ul className="limitations-list-disc">
            {result.limitations.map((lim, index) => (
              <li key={index}>{lim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sanitized Model Evidence Sub-Component */}
      <EvidenceList evidence={evidence} />
    </BentoCard>
  )
}
