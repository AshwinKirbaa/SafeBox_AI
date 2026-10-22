import React from 'react'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import type { RunRecord, RunSummary } from '../types/safebox'
import type { AppPage } from '../types/navigation'

interface WorkflowPageProps {
  run: RunRecord | null
  loading: boolean
  allRuns: RunSummary[]
  onSelectRunId: (runId: string) => void
  onNavigate: (page: AppPage) => void
}

export const WorkflowPage: React.FC<WorkflowPageProps> = ({
  run,
  loading,
  allRuns,
  onSelectRunId,
  onNavigate,
}) => {
  return (
    <div className="workflow-page-layout">
      <WorkflowCanvas
        run={run}
        loading={loading}
        allRuns={allRuns}
        onSelectRunId={onSelectRunId}
        onNavigate={onNavigate}
      />
    </div>
  )
}
