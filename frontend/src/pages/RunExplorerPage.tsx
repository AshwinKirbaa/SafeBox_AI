import React from 'react'
import { RunHistory } from '../components/RunHistory'
import type { RunSummary } from '../types/safebox'
import type { AppPage } from '../types/navigation'

interface RunExplorerPageProps {
  runs: RunSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  selectedRunId: string | null
  loading: boolean
  onSelectRun: (runId: string) => void
  onPageChange: (offset: number) => void
  onRefresh: () => void
  onFilterChange: (filters: { provider?: string; model?: string; status?: string }) => void
  onNavigate: (page: AppPage) => void
}

export const RunExplorerPage: React.FC<RunExplorerPageProps> = ({
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
  onNavigate,
}) => {
  const handleInspectRun = (runId: string) => {
    onSelectRun(runId)
    onNavigate('details')
  }

  return (
    <div className="page-container run-explorer-page">
      <RunHistory
        runs={runs}
        total={total}
        limit={limit}
        offset={offset}
        hasMore={hasMore}
        selectedRunId={selectedRunId}
        loading={loading}
        onSelectRun={handleInspectRun}
        onPageChange={onPageChange}
        onRefresh={onRefresh}
        onFilterChange={onFilterChange}
      />
    </div>
  )
}
