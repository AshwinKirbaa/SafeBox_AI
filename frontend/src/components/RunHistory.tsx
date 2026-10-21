import React, { useState } from 'react'
import {
  History,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { RunSummary } from '../types/safebox'

interface RunHistoryProps {
  runs: RunSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  selectedRunId: string | null
  loading: boolean
  onSelectRun: (runId: string) => void
  onPageChange: (newOffset: number) => void
  onRefresh: () => void
  onFilterChange?: (filters: { provider?: string; model?: string; status?: string }) => void
}

export const RunHistory: React.FC<RunHistoryProps> = ({
  runs,
  total,
  limit,
  offset,
  hasMore,
  selectedRunId,
  loading,
  onSelectRun,
  onPageChange,
  onRefresh,
  onFilterChange,
}) => {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit) || 1

  const [providerFilter, setProviderFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [modelSearch, setModelSearch] = useState<string>('')

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (onFilterChange) {
      onFilterChange({
        provider: providerFilter || undefined,
        status: statusFilter || undefined,
        model: modelSearch.trim() || undefined,
      })
    }
  }

  const handleResetFilter = () => {
    setProviderFilter('')
    setStatusFilter('')
    setModelSearch('')
    if (onFilterChange) {
      onFilterChange({})
    }
  }

  const getTargetBadge = (r: RunSummary) => {
    const isMock =
      r.target_mode === 'mock' ||
      r.provider === 'mock' ||
      (typeof r.model === 'string' && r.model.startsWith('mock-'))
    if (isMock) {
      return 'MOCK SIMULATOR'
    }
    if (r.target_mode === 'ollama' || r.provider === 'ollama') {
      return `OLLAMA · ${r.model || 'llama3.2:3b'}`
    }
    const prov = (r.provider || r.target_mode).toUpperCase()
    return `${prov} · ${r.model || 'default'}`
  }

  return (
    <div className="card run-history-card">
      <div className="card-header">
        <div className="card-header-title">
          <History className="card-header-icon" />
          <h2>Security Test Run History ({total})</h2>
        </div>

        <div className="history-header-actions">
          <button
            className="btn-ghost-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh run history"
          >
            <RefreshCw className={`icon-sm ${loading ? 'spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* History Filters Toolbar */}
      <form onSubmit={handleApplyFilter} className="history-filters-bar">
        <div className="filter-group">
          <Filter className="icon-xs text-muted" />
          <span className="text-xs font-semibold">Filter:</span>
        </div>

        <select
          className="form-select-sm"
          value={providerFilter}
          onChange={(e) => {
            setProviderFilter(e.target.value)
            if (onFilterChange) {
              onFilterChange({
                provider: e.target.value || undefined,
                status: statusFilter || undefined,
                model: modelSearch.trim() || undefined,
              })
            }
          }}
        >
          <option value="">All Providers</option>
          <option value="mock">Mock Simulator</option>
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
          <option value="huggingface">Hugging Face</option>
          <option value="vllm">vLLM</option>
          <option value="generic_http">Generic HTTP</option>
        </select>

        <select
          className="form-select-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            if (onFilterChange) {
              onFilterChange({
                provider: providerFilter || undefined,
                status: e.target.value || undefined,
                model: modelSearch.trim() || undefined,
              })
            }
          }}
        >
          <option value="">All Statuses</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
          <option value="ERROR">ERROR</option>
          <option value="INCONCLUSIVE">INCONCLUSIVE</option>
          <option value="UNSUPPORTED">UNSUPPORTED</option>
        </select>

        <input
          type="text"
          className="form-input-sm"
          placeholder="Search model name..."
          value={modelSearch}
          onChange={(e) => setModelSearch(e.target.value)}
        />

        <button type="submit" className="btn-secondary btn-xs">
          Apply
        </button>
        {(providerFilter || statusFilter || modelSearch) && (
          <button
            type="button"
            className="btn-link text-xs text-muted"
            onClick={handleResetFilter}
          >
            Reset
          </button>
        )}
      </form>

      {runs.length === 0 ? (
        <div className="empty-history-box">
          <Clock className="empty-icon" />
          <p className="empty-text">No security test runs recorded yet.</p>
          <span className="text-xs text-muted">
            Launch a test using the launcher above to generate your first audit record.
          </span>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="runs-table" data-testid="runs-history-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Security Test</th>
                <th>Target</th>
                <th>AI Verdict</th>
                <th>State</th>
                <th>Executed At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const isSelected = r.run_id === selectedRunId
                return (
                  <tr
                    key={r.run_id}
                    className={`run-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectRun(r.run_id)}
                  >
                    <td className="cell-run-id">
                      <code>{r.run_id.slice(0, 16)}...</code>
                    </td>
                    <td>
                      <span className="test-name-tag">{r.test_id}</span>
                      <span className="text-xs text-muted"> v{r.test_version}</span>
                    </td>
                    <td>
                      <span
                        className={`mode-badge mode-${(r.provider || r.target_mode).toLowerCase()}`}
                        data-testid={`history-target-${r.run_id}`}
                      >
                        {getTargetBadge(r)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} type="ai" size="sm" />
                    </td>
                    <td>
                      <span className={`state-pill state-${r.state.toLowerCase()}`}>
                        {r.state}
                      </span>
                    </td>
                    <td className="text-xs text-muted cell-time">
                      {new Date(r.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn-select-run ${isSelected ? 'btn-viewing' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectRun(r.run_id)
                        }}
                        aria-label={isSelected ? `Viewing run ${r.run_id}. Click to view details.` : `Inspect run ${r.run_id}`}
                        title={isSelected ? 'Currently viewing in detail panel. Click to view details.' : 'Inspect this run in detail view'}
                      >
                        <ExternalLink className="btn-mini-icon" />
                        <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Showing {offset + 1}–{Math.min(offset + runs.length, total)} of {total} runs
          </span>

          <div className="pagination-buttons">
            <button
              className="btn-page"
              disabled={offset <= 0 || loading}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              <ChevronLeft className="page-icon" />
              <span>Previous</span>
            </button>
            <span className="page-current">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn-page"
              disabled={!hasMore || loading}
              onClick={() => onPageChange(offset + limit)}
            >
              <span>Next</span>
              <ChevronRight className="page-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
