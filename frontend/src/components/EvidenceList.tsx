import React from 'react'
import {
  FileText,
  ShieldAlert,
  Scissors,
  EyeOff,
} from 'lucide-react'
import type { EvidenceItem } from '../types/safebox'

interface EvidenceListProps {
  evidence: EvidenceItem[]
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence }) => {
  if (!evidence || evidence.length === 0) {
    return (
      <div className="empty-evidence-box">
        <FileText className="empty-icon" />
        <p>No model output evidence recorded for this run.</p>
      </div>
    )
  }

  // Format content with highlighted [REDACTED] markers
  const renderContentWithHighlights = (content: string) => {
    if (!content.includes('[REDACTED]')) {
      return <span>{content}</span>
    }

    const parts = content.split(/(\[REDACTED\])/g)
    return (
      <>
        {parts.map((part, index) =>
          part === '[REDACTED]' ? (
            <span key={index} className="redacted-tag" title="Protected canary / secret sanitized by backend EvidenceService">
              <EyeOff className="redacted-icon" />
              [REDACTED]
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    )
  }

  return (
    <div className="evidence-list-container">
      <div className="evidence-list-header">
        <div className="evidence-title-group">
          <FileText className="section-icon" />
          <h3>Sanitized Model Evidence ({evidence.length} items)</h3>
        </div>
        <span className="untrusted-badge" title="Content is untrusted model output. Escaped and bounded.">
          <ShieldAlert className="badge-mini-icon" />
          UNTRUSTED MODEL OUTPUT
        </span>
      </div>

      <div className="evidence-items-wrapper">
        {evidence.map((item) => (
          <div key={item.evidence_id} className={`evidence-card kind-${item.kind}`}>
            <div className="evidence-card-header">
              <div className="evidence-id-row">
                <span className="evidence-id-pill">{item.evidence_id}</span>
                <span className="evidence-kind-pill">{item.kind.replace('_', ' ').toUpperCase()}</span>
                {item.execution_index !== null && (
                  <span className="evidence-index-pill">
                    Run #{item.execution_index + 1}
                  </span>
                )}
              </div>

              <div className="evidence-badges">
                {item.redacted && (
                  <span className="badge-pill badge-redacted" title="Contained secret canary which was safely redacted prior to API export">
                    <EyeOff className="pill-mini-icon" />
                    CANARY REDACTED
                  </span>
                )}
                {item.truncated && (
                  <span className="badge-pill badge-truncated" title="Output excerpt bounded to maximum configured characters">
                    <Scissors className="pill-mini-icon" />
                    TRUNCATED
                  </span>
                )}
                <span className="evidence-size-pill">
                  {item.size_chars} chars
                </span>
              </div>
            </div>

            <div className="evidence-content-box">
              <pre className="evidence-pre">
                <code>{renderContentWithHighlights(item.content)}</code>
              </pre>
            </div>

            {(item.rule_id || item.observed_status) && (
              <div className="evidence-footer">
                {item.rule_id && (
                  <span className="footer-rule">
                    Rule: <code>{item.rule_id} v{item.rule_version}</code>
                  </span>
                )}
                {item.observed_status && (
                  <span className={`footer-status status-${item.observed_status.toLowerCase()}`}>
                    Observed: {item.observed_status}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
