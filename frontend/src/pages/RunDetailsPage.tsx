import React from 'react'
import { RunDetailView } from '../components/RunDetailView'
import type { RunRecord } from '../types/safebox'
import type { AppPage } from '../types/navigation'
import { Network, History } from 'lucide-react'

interface RunDetailsPageProps {
  run: RunRecord | null
  loading: boolean
  selectedRunId: string | null
  error: string | null
  onRetry: () => void
  onRefreshRun?: (runId: string) => Promise<void> | void
  onNavigate: (page: AppPage) => void
}

export const RunDetailsPage: React.FC<RunDetailsPageProps> = ({
  run,
  loading,
  selectedRunId,
  error,
  onRetry,
  onRefreshRun,
  onNavigate,
}) => {
  return (
    <div className="page-container run-details-page">
      {/* Quick Navigation Action Header */}
      <div className="details-page-header-actions mb-3">
        <div className="left-info">
          <span className="text-muted text-xs">
            Viewing comprehensive verdicts, redacted token logs, and infrastructure checks.
          </span>
        </div>
        <div className="right-actions">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => onNavigate('workflow')}
            title="Inspect this run in the interactive node workflow canvas"
          >
            <Network className="icon-xs" />
            <span>Open in Workflow Canvas</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => onNavigate('runs')}
            title="Browse all evaluated runs"
          >
            <History className="icon-xs" />
            <span>Return to Run Explorer</span>
          </button>
        </div>
      </div>

      {/* Main RunDetailView Component */}
      <RunDetailView
        run={run}
        loading={loading}
        selectedRunId={selectedRunId}
        error={error}
        onRetry={onRetry}
        onRefreshRun={onRefreshRun}
      />
    </div>
  )
}
