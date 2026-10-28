import React from 'react';
import { Icon, Emblem } from './Effects';

export function OverviewPage({
  health,
  connections = [],
  discoveredModelCount = 0,
  runList = { items: [], total: 0 },
  dockerStatus = 'Active',
  onNavigate,
  onViewRun,
  onRefresh
}) {
  const runs = runList.items || [];
  const totalEvaluations = runList.total || runs.length;

  const passCount = runs.filter(r => r.status === 'PASS').length;
  const failCount = runs.filter(r => r.status === 'FAIL').length;
  const errorCount = runs.filter(r => r.status === 'ERROR' || r.status === 'INCONCLUSIVE').length;

  const latestRun = runs[0];

  return (
    <div className="overview-page-container">
      {/* Header and top actions */}
      <div className="page-header-row">
        <div>
          <span className="eyebrow">SAFEBOX SYSTEM METRICS</span>
          <h2 className="page-title">SafeBox Operational Overview</h2>
          <p className="page-subtitle">Real-time status of evaluations, configured provider connections, and infrastructure isolation probes.</p>
        </div>
        <div className="page-header-actions">
          <button className="studio-button secondary" onClick={onRefresh}>
            <Icon name="refresh" /> <span>REFRESH METRICS</span>
          </button>
          <button className="studio-button primary" onClick={() => onNavigate('test-lab')}>
            <span>RUN TEST</span> <Icon name="shield" />
          </button>
          <button className="studio-button secondary" onClick={() => onNavigate('providers')}>
            <span>CONFIGURE PROVIDER</span> <Icon name="compare" />
          </button>
          {latestRun && (
            <button className="studio-button secondary" onClick={() => onViewRun(latestRun.run_id)}>
              <span>VIEW RUN</span> <Icon name="file" />
            </button>
          )}
        </div>
      </div>

      {/* Core Summary Metric Cards */}
      <div className="overview-metrics-grid">
        <div className="overview-metric-card">
          <span className="eyebrow">TOTAL EVALUATIONS</span>
          <div className="metric-number">{totalEvaluations}</div>
          <span className="metric-caption">Recorded test executions on backend</span>
        </div>

        <div className="overview-metric-card">
          <span className="eyebrow">PASS / FAIL COUNT</span>
          <div className="metric-number-split">
            <span className="pass-text">{passCount} <small className="eyebrow">PASS</small></span>
            <span className="divider">/</span>
            <span className="fail-text">{failCount} <small className="eyebrow">FAIL</small></span>
            {errorCount > 0 && <span className="error-text">({errorCount} ERR)</span>}
          </div>
          <span className="metric-caption">AI behavioral audit outcomes</span>
        </div>

        <div className="overview-metric-card">
          <span className="eyebrow">CONFIGURED PROVIDERS</span>
          <div className="metric-number">{connections.length}</div>
          <span className="metric-caption">Active inference provider accounts</span>
        </div>

        <div className="overview-metric-card">
          <span className="eyebrow">DISCOVERED MODELS</span>
          <div className="metric-number">{discoveredModelCount}</div>
          <span className="metric-caption">Available models across connections</span>
        </div>
      </div>

      {/* Infrastructure & Services Status */}
      <div className="status-banner-card">
        <div className="status-banner-title">
          <span className="eyebrow">RUNTIME ENVIRONMENT READINESS</span>
          <h3>Docker, Ollama, and Backend API Status</h3>
        </div>
        <div className="status-pills-row">
          <div className={`status-pill ${health ? 'healthy' : 'unhealthy'}`}>
            <span className="indicator-dot" />
            <div>
              <span className="eyebrow">API SERVICE</span>
              <strong>{health ? `FASTAPI v${health.version}` : 'UNAVAILABLE'}</strong>
            </div>
          </div>

          <div className={`status-pill ${health?.database_ok ? 'healthy' : 'unhealthy'}`}>
            <span className="indicator-dot" />
            <div>
              <span className="eyebrow">SQLITE DATABASE</span>
              <strong>{health?.database_ok ? 'ONLINE & SECURED' : 'UNREACHABLE'}</strong>
            </div>
          </div>

          <div className={`status-pill ${health?.ollama?.reachable ? 'healthy' : 'pending'}`}>
            <span className="indicator-dot" />
            <div>
              <span className="eyebrow">OLLAMA ENGINE</span>
              <strong>{health?.ollama?.reachable ? `REACHABLE (${health.ollama.configured_model})` : 'UNREACHABLE / STANDBY'}</strong>
            </div>
          </div>

          <div className={`status-pill ${dockerStatus === 'Active' || dockerStatus === 'Running' ? 'healthy' : 'pending'}`}>
            <span className="indicator-dot" />
            <div>
              <span className="eyebrow">DOCKER SANDBOX</span>
              <strong>{dockerStatus}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Test Runs Section */}
      <section className="recent-runs-section">
        <div className="section-head-row">
          <div>
            <span className="eyebrow">EVALUATION AUDIT TRAIL</span>
            <h3>Recent Test Runs</h3>
          </div>
          <button className="link-button" onClick={() => onNavigate('runs')}>
            Open Run Explorer <Icon name="diagonal" />
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="empty-runs-card">
            <p>No recent evaluation runs found on this SafeBox instance.</p>
            <button className="studio-button primary" onClick={() => onNavigate('test-lab')}>
              <span>LAUNCH YOUR FIRST TEST</span> <Icon name="shield" />
            </button>
          </div>
        ) : (
          <div className="runs-table-wrapper">
            <table className="styled-runs-table">
              <thead>
                <tr>
                  <th>RUN ID</th>
                  <th>MODEL</th>
                  <th>SECURITY TEST</th>
                  <th>VERDICT</th>
                  <th>LATENCY</th>
                  <th>TIMESTAMP</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map(r => (
                  <tr key={r.run_id} className="run-table-row">
                    <td className="monospace font-bold">{r.run_id}</td>
                    <td>{r.model || 'Unknown'}</td>
                    <td>{r.test_id}</td>
                    <td>
                      <span className={`verdict-badge ${r.status || 'PENDING'}`}>
                        {r.status || 'PENDING'}
                      </span>
                    </td>
                    <td>{r.latency_ms ? `${r.latency_ms} ms` : '—'}</td>
                    <td className="monospace text-muted">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        className="table-action-btn"
                        onClick={() => onViewRun(r.run_id)}
                      >
                        View Run <Icon name="diagonal" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
