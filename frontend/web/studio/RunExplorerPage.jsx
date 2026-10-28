import React, { useState } from 'react';
import { Icon } from './Effects';

export function RunExplorerPage({
  runs = [],
  totalRuns = 0,
  hasMore = false,
  offset = 0,
  onOffsetChange,
  onViewRun,
  onRefresh,
  busy = false
}) {
  const [searchRunId, setSearchRunId] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [testFilter, setTestFilter] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');

  // Extract distinct tests from runs for dropdown filter
  const testOptions = [...new Set(runs.map(r => r.test_id).filter(Boolean))];

  // Client-side/view filter matching
  const filteredRuns = runs.filter(r => {
    if (searchRunId && !r.run_id.toLowerCase().includes(searchRunId.toLowerCase().trim())) {
      return false;
    }
    if (modelFilter && !(r.model || '').toLowerCase().includes(modelFilter.toLowerCase().trim())) {
      return false;
    }
    if (testFilter && r.test_id !== testFilter) {
      return false;
    }
    if (verdictFilter && r.status !== verdictFilter) {
      return false;
    }
    return true;
  });

  function clearAllFilters() {
    setSearchRunId('');
    setModelFilter('');
    setTestFilter('');
    setVerdictFilter('');
  }

  const hasActiveFilters = Boolean(searchRunId || modelFilter || testFilter || verdictFilter);

  return (
    <div className="run-explorer-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="eyebrow">AUDIT HISTORY & EVALUATION RECORDS</span>
          <h2 className="page-title">Run Explorer</h2>
          <p className="page-subtitle">
            Search, filter, and inspect previous AI safety evaluation runs and sandbox verification reports.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="studio-button secondary" onClick={onRefresh} disabled={busy}>
            <Icon name="refresh" /> <span>REFRESH RUNS</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="explorer-filter-card">
        <div className="filter-grid">
          {/* Search by run ID */}
          <div className="filter-input-cell">
            <label className="field-label eyebrow" htmlFor="search-run-id">
              SEARCH BY RUN ID
            </label>
            <div className="input-with-icon">
              <Icon name="search" />
              <input
                id="search-run-id"
                type="text"
                className="filter-text-input"
                value={searchRunId}
                onChange={e => setSearchRunId(e.target.value)}
                placeholder="run_0123456789..."
              />
            </div>
          </div>

          {/* Model filter */}
          <div className="filter-input-cell">
            <label className="field-label eyebrow" htmlFor="filter-model">
              MODEL FILTER
            </label>
            <input
              id="filter-model"
              type="text"
              className="filter-text-input"
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              placeholder="e.g. llama3.2, gpt-4o"
            />
          </div>

          {/* Test filter */}
          <div className="filter-input-cell">
            <label className="field-label eyebrow" htmlFor="filter-test">
              TEST FILTER
            </label>
            <select
              id="filter-test"
              className="filter-dropdown"
              value={testFilter}
              onChange={e => setTestFilter(e.target.value)}
            >
              <option value="">All Security Tests</option>
              {testOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Verdict filter */}
          <div className="filter-input-cell">
            <label className="field-label eyebrow" htmlFor="filter-verdict">
              VERDICT FILTER
            </label>
            <select
              id="filter-verdict"
              className="filter-dropdown"
              value={verdictFilter}
              onChange={e => setVerdictFilter(e.target.value)}
            >
              <option value="">All Verdicts</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="ERROR">ERROR</option>
              <option value="INCONCLUSIVE">INCONCLUSIVE</option>
              <option value="UNSUPPORTED">UNSUPPORTED</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="filter-footer-row">
            <span className="filter-count-note">
              Showing {filteredRuns.length} of {runs.length} loaded records
            </span>
            <button className="clear-filters-link" onClick={clearAllFilters}>
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Runs Table Section */}
      <section className="runs-table-section">
        {filteredRuns.length === 0 ? (
          <div className="empty-runs-state">
            <Icon name="search" />
            <h3>No matching runs found</h3>
            <p>Try modifying your search query or verdict filter.</p>
            {hasActiveFilters && (
              <button className="studio-button secondary" onClick={clearAllFilters}>
                <span>CLEAR FILTERS</span>
              </button>
            )}
          </div>
        ) : (
          <div className="runs-table-wrapper">
            <table className="styled-runs-table">
              <thead>
                <tr>
                  <th>RUN ID</th>
                  <th>MODEL</th>
                  <th>TEST</th>
                  <th>VERDICT</th>
                  <th>LATENCY</th>
                  <th>DATE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map(r => (
                  <tr key={r.run_id} className="run-row-interactive">
                    <td className="monospace font-bold id-cell">
                      <span>{r.run_id}</span>
                    </td>
                    <td>{r.model || 'Unknown'}</td>
                    <td>
                      <span className="test-name-tag">{r.test_id}</span>
                    </td>
                    <td>
                      <span className={`verdict-badge ${r.status || 'PENDING'}`}>
                        {r.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="monospace">{r.latency_ms ? `${r.latency_ms} ms` : '—'}</td>
                    <td className="monospace text-muted">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        className="view-run-btn"
                        onClick={() => onViewRun(r.run_id)}
                      >
                        <span>View</span> <Icon name="diagonal" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="pagination-bar">
          <button
            className="pagination-btn"
            disabled={offset === 0 || busy}
            onClick={() => onOffsetChange(Math.max(0, offset - 10))}
          >
            ← Previous
          </button>
          <span className="page-indicator eyebrow">
            Page {Math.floor(offset / 10) + 1} · {totalRuns} Total Run(s)
          </span>
          <button
            className="pagination-btn"
            disabled={!hasMore || busy}
            onClick={() => onOffsetChange(offset + 10)}
          >
            Next →
          </button>
        </div>
      </section>
    </div>
  );
}
