import React from 'react'
import { RunHistory } from '../components/RunHistory'
import { MagicBento } from '../components/MagicBento'
import type { RunSummary } from '../types/safebox'
import type { AppPage } from '../types/navigation'
import { History, Clock, ShieldCheck, FileSearch } from 'lucide-react'

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

  const passCount = runs.filter((r) => r.status === 'PASS').length
  const failCount = runs.filter((r) => r.status === 'FAIL').length
  const passRate = runs.length > 0 ? Math.round((passCount / runs.length) * 100) : 0

  const summaryItems = [
    {
      title: 'Total Audits Recorded',
      value: String(total),
      label: 'PERSISTENT RECORDS',
      description: 'Verified security audit records in local archive',
      glowColor: '#38bdf8',
      accentColor: '#38bdf8',
      icon: <History className="icon-sm text-cyan" />,
    },
    {
      title: 'Runs on Active Page',
      value: `${runs.length} in View`,
      label: `PAGE ${Math.floor(offset / limit) + 1} OF ${Math.ceil(total / limit) || 1}`,
      description: `Displaying batch offsets ${offset + 1} through ${Math.min(offset + runs.length, total)}`,
      glowColor: '#38bdf8',
      accentColor: '#38bdf8',
      icon: <Clock className="icon-sm text-cyan" />,
    },
    {
      title: 'Page Behavioral Pass Rate',
      value: `${passRate}%`,
      label: `${passCount} PASS · ${failCount} FAIL`,
      description: 'Compliance rate across models on current page view',
      glowColor: passRate >= 70 ? '#10b981' : '#f43f5e',
      accentColor: passRate >= 70 ? '#10b981' : '#f43f5e',
      icon: <ShieldCheck className="icon-sm text-emerald" />,
    },
    {
      title: 'Inspected Audit Run',
      value: selectedRunId ? `${selectedRunId.slice(0, 14)}...` : 'None Selected',
      label: 'DETAIL TARGET',
      description: selectedRunId ? 'Click to inspect behavioral evidence & sandbox probes' : 'Select any run below to inspect deep evidence',
      glowColor: '#c084fc',
      accentColor: '#c084fc',
      icon: <FileSearch className="icon-sm text-violet" />,
      onClick: selectedRunId ? () => handleInspectRun(selectedRunId) : undefined,
    },
  ]

  return (
    <div className="page-container run-explorer-page">
      <div className="run-explorer-metrics mb-4" data-testid="run-explorer-metrics">
        <MagicBento items={summaryItems} gridCols={4} cardHeight="130px" />
      </div>

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
