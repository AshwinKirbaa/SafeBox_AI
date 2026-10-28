import React, { useState } from 'react';
import { Icon, StarBurst } from './Effects';
import { REQUIRED_CHECKS } from './run-record';

export function RunDetailsPage({
  run,
  onNavigate,
  onRerunTest,
  onLaunchWorker,
  busy = false,
  health
}) {
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(false);

  if (!run) {
    return (
      <div className="run-details-empty">
        <Icon name="search" />
        <h2>No Run Selected</h2>
        <p>Please select an evaluation run from the Run Explorer or Overview.</p>
        <button className="studio-button primary" onClick={() => onNavigate('runs')}>
          <span>RETURN TO RUN EXPLORER</span>
          <Icon name="diagonal" />
        </button>
      </div>
    );
  }

  const result = run.result || {};
  const infra = run.infrastructure || { status: 'MISSING', checks: [] };
  const target = run.target || {};
  const checks = infra.checks || [];

  const modelOutputEvidence = (run.evidence || []).find(e => e.kind === 'model_output');
  const sanitizedOutput = modelOutputEvidence?.content || result.sanitized_output || 'No sanitized output recorded for this run.';

  async function handleCopyId() {
    try {
      await navigator.clipboard.writeText(run.run_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  function handleExport() {
    const jsonStr = JSON.stringify(run, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safebox-run-${run.run_id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBurst(true);
    setTimeout(() => setBurst(false), 1000);
  }

  return (
    <div className="run-details-container">
      {/* Action Bar with the required buttons: Return to Run Explorer, Re-run Test, Export Report */}
      <div className="details-action-bar">
        <button className="studio-button secondary" onClick={() => onNavigate('runs')}>
          <Icon name="diagonal" /> <span>RETURN TO RUN EXPLORER</span>
        </button>

        <div className="action-buttons-group">
          <button
            className="studio-button secondary"
            onClick={() => onRerunTest(run)}
            disabled={busy}
          >
            <Icon name="refresh" /> <span>RE-RUN TEST</span>
          </button>

          <button className="studio-button primary" onClick={handleExport}>
            <span>EXPORT REPORT</span> <Icon name="file" />
            <StarBurst active={burst} />
          </button>
        </div>
      </div>

      {/* Primary Overview Banner */}
      <section className="run-summary-banner">
        <div className="summary-banner-top">
          <div>
            <span className="eyebrow">AUDIT RECORD EVIDENCE</span>
            <div className="run-id-row">
              <h2 className="run-id-title monospace">{run.run_id}</h2>
              <button className="copy-icon-btn" onClick={handleCopyId} title="Copy Run ID">
                <Icon name="file" />
                <span className="copy-label">{copied ? 'COPIED!' : 'COPY ID'}</span>
              </button>
            </div>
          </div>
          <div className="overall-status-box">
            <span className="eyebrow">OVERALL STATUS</span>
            <span className={`status-pill-big ${result.status || 'PENDING'}`}>
              {result.status || 'PENDING'}
            </span>
          </div>
        </div>

        {/* Core Metadata Grid: Model and provider, Security test, Latency */}
        <div className="summary-metadata-grid">
          <div className="metadata-cell">
            <span className="eyebrow">MODEL AND PROVIDER</span>
            <strong className="cell-value">
              {target.model || 'Unknown Model'} <small>({target.provider || target.mode || 'Local'})</small>
            </strong>
          </div>

          <div className="metadata-cell">
            <span className="eyebrow">SECURITY TEST</span>
            <strong className="cell-value">{run.test_id}</strong>
          </div>

          <div className="metadata-cell">
            <span className="eyebrow">LATENCY</span>
            <strong className="cell-value">
              {result.observed_latency_ms != null ? `${result.observed_latency_ms} ms` : '—'}
            </strong>
          </div>

          <div className="metadata-cell">
            <span className="eyebrow">TIMESTAMP</span>
            <strong className="cell-value monospace">
              {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
            </strong>
          </div>
        </div>
      </section>

      {/* Dual Evaluation Planes: AI Evaluation vs Infrastructure Evaluation */}
      <div className="evaluation-dual-plane-grid">
        {/* Plane A: AI Evaluation */}
        <section className="evaluation-plane-card ai-plane">
          <div className="plane-header">
            <span className="eyebrow">PLANE A / MODEL BEHAVIOR</span>
            <h3>AI Evaluation</h3>
            <span className={`verdict-badge-lg ${result.status || 'PENDING'}`}>
              {result.status || 'PENDING'}
            </span>
          </div>

          <div className="plane-content-block">
            <div className="eval-detail-group">
              <span className="eyebrow">EXPECTED BEHAVIOUR</span>
              <p className="expected-rule-text">
                {result.expected_behavior || 'Model must uphold system directives and refuse to leak protected secrets or execute adversarial overrides.'}
              </p>
            </div>

            <div className="eval-detail-group">
              <span className="eyebrow">OBSERVED RESULT</span>
              <div className="observed-result-box">
                <p>{result.explanation || 'Evaluation completed without error.'}</p>
                {result.matched_indicators && result.matched_indicators.length > 0 && (
                  <div className="matched-indicators-row">
                    <span className="eyebrow">MATCHED SIGNALS:</span>
                    {result.matched_indicators.map((ind, i) => (
                      <span key={i} className="indicator-chip">{ind}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="eval-detail-group">
              <span className="eyebrow">SANITIZED MODEL OUTPUT</span>
              <pre className="sanitized-output-block">
                {sanitizedOutput}
              </pre>
            </div>

            {/* Error details */}
            {(result.error_message || result.error_kind) && (
              <div className="eval-detail-group error-section">
                <span className="eyebrow text-error">ERROR DETAILS</span>
                <div className="error-details-box">
                  <strong>{result.error_kind || 'Execution Error'}:</strong>
                  <p>{result.error_message}</p>
                </div>
              </div>
            )}

            {result.token_usage && (
              <div className="eval-detail-group token-stats-group">
                <span className="eyebrow">TOKEN USAGE</span>
                <span className="token-pills">
                  Prompt: {result.token_usage.prompt_tokens ?? '—'} · Completion: {result.token_usage.completion_tokens ?? '—'} · Total: {result.token_usage.total_tokens ?? '—'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Plane B: Infrastructure Evaluation */}
        <section className="evaluation-plane-card infra-plane">
          <div className="plane-header">
            <div className="plane-title-box">
              <span className="eyebrow">PLANE B / HARDENED CONTAINER ISOLATION</span>
              <h3>Infrastructure Evaluation</h3>
            </div>
            <span className={`verdict-badge-lg ${infra.status || 'MISSING'}`}>
              {infra.status || 'MISSING'}
            </span>
          </div>

          <p className="infra-plane-note">
            Verifies the local SafeBox execution sandbox. Isolation checks are evaluated independently of AI model behavior.
          </p>

          {/* Launch Docker Verification Button if needed */}
          {(infra.status === 'MISSING' || infra.status === 'PENDING' || checks.length === 0) && (
            <div className="launch-worker-panel">
              <p>Container isolation checks have not been run for this execution.</p>
              <button
                className="studio-button primary"
                onClick={() => onLaunchWorker(run.run_id)}
                disabled={busy || !health}
              >
                <span>LAUNCH DOCKER VERIFICATION</span>
                <Icon name="shield" />
              </button>
            </div>
          )}

          {/* Seven isolation probe results */}
          <div className="isolation-probes-container">
            <span className="eyebrow">SEVEN ISOLATION PROBES</span>
            <div className="probes-list">
              {REQUIRED_CHECKS.map((checkId, idx) => {
                const check = checks.find(c => c.check_id === checkId);
                const probeStatus = check?.status || check?.reported_verdict || 'MISSING';
                return (
                  <div key={checkId} className="isolation-probe-item">
                    <div className="probe-item-header">
                      <span className="probe-index monospace">0{idx + 1}</span>
                      <strong className="probe-name">{checkId.replaceAll('-', ' ').toUpperCase()}</strong>
                      <span className={`probe-status-chip ${probeStatus}`}>
                        {probeStatus}
                      </span>
                    </div>

                    <div className="probe-item-body">
                      <div className="probe-comp-row">
                        <div>
                          <span className="eyebrow">OBSERVED:</span>
                          <code>{check?.observed || 'Check not yet reported'}</code>
                        </div>
                        <div>
                          <span className="eyebrow">EXPECTED:</span>
                          <code>{check?.expected || 'Security invariant enforced'}</code>
                        </div>
                      </div>

                      {/* Evidence and limitations */}
                      {(check?.evidence_detail || check?.evidence_ref || check?.limitation || check?.error) && (
                        <div className="probe-evidence-row">
                          <span className="eyebrow">EVIDENCE & SCOPE:</span>
                          <p>
                            {check.evidence_detail && <span>{check.evidence_detail} </span>}
                            {check.evidence_ref && <code className="ref-tag">[{check.evidence_ref}] </code>}
                            {check.limitation && <em className="limitation-note">{check.limitation}</em>}
                            {check.error && <span className="error-note text-error">{check.error}</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
