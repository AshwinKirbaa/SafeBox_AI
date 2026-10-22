import React, { useEffect, useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { OverviewPage } from './pages/OverviewPage'
import { TestLabPage } from './pages/TestLabPage'
import { WorkflowPage } from './pages/WorkflowPage'
import { RunExplorerPage } from './pages/RunExplorerPage'
import { RunDetailsPage } from './pages/RunDetailsPage'
import { ModelConnectionsModal } from './components/ModelConnectionsModal'
import { api } from './services/api'
import type { AppPage } from './types/navigation'
import type {
  HealthResponse,
  SecurityTestMeta,
  RunSummary,
  RunRecord,
  RunRequest,
  SavedConnection,
} from './types/safebox'
import { AlertCircle, X, CheckCircle2 } from 'lucide-react'
import './App.css'

const getPageFromHash = (): AppPage => {
  if (typeof window === 'undefined') return 'overview'
  const hash = window.location.hash.toLowerCase()
  if (hash.includes('test-lab') || hash.includes('launcher')) return 'test-lab'
  if (hash.includes('workflow') || hash.includes('canvas')) return 'workflow'
  if (hash.includes('runs') || hash.includes('history') || hash.includes('explorer')) return 'runs'
  if (hash.includes('details') || hash.includes('inspection')) return 'details'
  return 'overview'
}

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<AppPage>(() => getPageFromHash())

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [tests, setTests] = useState<SecurityTestMeta[]>([])
  const [loadingTests, setLoadingTests] = useState<boolean>(true)

  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState<boolean>(false)

  const [runs, setRuns] = useState<RunSummary[]>([])
  const [totalRuns, setTotalRuns] = useState<number>(0)
  const [runOffset, setRunOffset] = useState<number>(0)
  const [hasMoreRuns, setHasMoreRuns] = useState<boolean>(false)
  const [loadingRuns, setLoadingRuns] = useState<boolean>(true)
  const [filters, setFilters] = useState<{ provider?: string; model?: string; status?: string }>({})

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null)

  // Listen to browser hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const page = getPageFromHash()
      setActivePage(page)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateTo = useCallback((page: AppPage) => {
    setActivePage(page)
    if (typeof window !== 'undefined' && window.location.hash !== `#/${page}`) {
      window.location.hash = `#/${page}`
    }
  }, [])

  // 1. Fetch Health
  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true)
    try {
      const data = await api.getHealth()
      setHealth(data)
      setHealthError(null)
    } catch (err) {
      setHealthError((err as Error).message)
    } finally {
      setLoadingHealth(false)
    }
  }, [])

  // 2. Fetch Tests
  const fetchTests = useCallback(async () => {
    setLoadingTests(true)
    try {
      const data = await api.getSecurityTests()
      setTests(data.items)
    } catch (err) {
      setBannerError(`Failed to load security tests: ${(err as Error).message}`)
    } finally {
      setLoadingTests(false)
    }
  }, [])

  // 3. Fetch Saved Connections
  const fetchConnections = useCallback(async () => {
    try {
      const data = await api.getConnections()
      setConnections(data.items)
    } catch {
      // ignore
    }
  }, [])

  // 4. Fetch Runs History
  const fetchRuns = useCallback(
    async (offset = 0, currentFilters = filters) => {
      setLoadingRuns(true)
      try {
        const data = await api.getRuns(10, offset, currentFilters)
        setRuns(data.items)
        setTotalRuns(data.total)
        setRunOffset(data.offset)
        setHasMoreRuns(data.has_more)

        // Automatically select the newest run if none selected
        if (!selectedRunId && data.items.length > 0) {
          setSelectedRunId(data.items[0].run_id)
        }
      } catch (err) {
        setBannerError(`Failed to load run history: ${(err as Error).message}`)
      } finally {
        setLoadingRuns(false)
      }
    },
    [selectedRunId, filters]
  )

  // 5. Fetch Specific Run Detail
  const fetchRunDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true)
    setDetailError(null)
    try {
      const data = await api.getRun(runId)
      setSelectedRun(data)
    } catch (err) {
      const msg = `Failed to load run ${runId}: ${(err as Error).message}`
      setDetailError(msg)
      setBannerError(msg)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId)
  }, [])

  const handleRetryDetail = useCallback(() => {
    if (selectedRunId) {
      void fetchRunDetail(selectedRunId)
    }
  }, [selectedRunId, fetchRunDetail])

  // Initial load
  useEffect(() => {
    let ignore = false
    const init = async () => {
      try {
        const [healthData, testsData, connData, runsData] = await Promise.all([
          api.getHealth(),
          api.getSecurityTests(),
          api.getConnections().catch(() => ({ items: [] })),
          api.getRuns(10, 0),
        ])
        if (!ignore) {
          setHealth(healthData)
          setHealthError(null)
          setTests(testsData.items)
          setConnections(connData.items)
          setRuns(runsData.items)
          setTotalRuns(runsData.total)
          setRunOffset(runsData.offset)
          setHasMoreRuns(runsData.has_more)
          if (runsData.items.length > 0) {
            setSelectedRunId(runsData.items[0].run_id)
          }
        }
      } catch (err) {
        if (!ignore) {
          setHealthError((err as Error).message)
        }
      } finally {
        if (!ignore) {
          setLoadingHealth(false)
          setLoadingTests(false)
          setLoadingRuns(false)
        }
      }
    }
    void init()
    return () => {
      ignore = true
    }
  }, [])

  // When selectedRunId changes, fetch details
  useEffect(() => {
    if (!selectedRunId) return
    let ignore = false
    const loadDetail = async () => {
      setLoadingDetail(true)
      setDetailError(null)
      try {
        const data = await api.getRun(selectedRunId)
        if (!ignore) {
          setSelectedRun(data)
        }
      } catch (err) {
        if (!ignore) {
          const msg = `Failed to load run ${selectedRunId}: ${(err as Error).message}`
          setDetailError(msg)
          setBannerError(msg)
        }
      } finally {
        if (!ignore) {
          setLoadingDetail(false)
        }
      }
    }
    void loadDetail()
    return () => {
      ignore = true
    }
  }, [selectedRunId])

  // Handle Launch Test
  const handleRunTest = async (req: RunRequest) => {
    setIsRunning(true)
    setBannerError(null)
    setBannerSuccess(null)
    setDetailError(null)
    try {
      const newRecord = await api.runSecurityTest(req)
      setSelectedRun(newRecord)
      setSelectedRunId(newRecord.run_id)
      setBannerSuccess(
        `Security test completed. Verdict: ${newRecord.result?.status || 'COMPLETED'} for run ${newRecord.run_id}`
      )
      // Refresh history list
      fetchRuns(0, filters)
    } catch (err) {
      setBannerError(`Security test execution failed: ${(err as Error).message}`)
    } finally {
      setIsRunning(false)
    }
  }

  // Handle Filter Change
  const handleFilterChange = (newFilters: { provider?: string; model?: string; status?: string }) => {
    setFilters(newFilters)
    fetchRuns(0, newFilters)
  }

  // Refresh All
  const handleRefreshAll = () => {
    fetchHealth()
    fetchTests()
    fetchConnections()
    fetchRuns(runOffset, filters)
    if (selectedRunId) {
      fetchRunDetail(selectedRunId)
    }
  }

  return (
    <div className="safebox-app-shell">
      {/* 1. Persistent Compact Left Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        onOpenConnections={() => setIsConnectionsModalOpen(true)}
        connectionCount={connections.length}
        health={health}
        healthError={healthError}
      />

      {/* 2. Main Shell Layout (TopBar + Dedicated Page Content) */}
      <div className="app-shell-main">
        {/* Slim Top Header Bar */}
        <TopBar
          activePage={activePage}
          selectedRun={selectedRun}
          health={health}
          loadingHealth={loadingHealth}
          healthError={healthError}
          onRefresh={handleRefreshAll}
          onNavigate={navigateTo}
        />

        {/* Global Notifications Banner */}
        <div className="shell-alerts-container">
          {bannerError && (
            <div className="alert-banner alert-error" role="alert">
              <div className="alert-content">
                <AlertCircle className="alert-icon" />
                <span>{bannerError}</span>
              </div>
              <button
                type="button"
                className="btn-close-alert"
                onClick={() => setBannerError(null)}
                aria-label="Dismiss alert"
              >
                <X className="close-icon" />
              </button>
            </div>
          )}

          {bannerSuccess && (
            <div className="alert-banner alert-success" role="alert">
              <div className="alert-content">
                <CheckCircle2 className="alert-icon" />
                <span>{bannerSuccess}</span>
              </div>
              <button
                type="button"
                className="btn-close-alert"
                onClick={() => setBannerSuccess(null)}
                aria-label="Dismiss alert"
              >
                <X className="close-icon" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Primary Content Area: One Primary Page at a Time */}
        <main className="app-page-viewport">
          {activePage === 'overview' && (
            <OverviewPage
              health={health}
              healthError={healthError}
              runs={runs}
              totalRuns={totalRuns}
              selectedRun={selectedRun}
              onSelectRun={handleSelectRun}
              onNavigate={navigateTo}
            />
          )}

          {activePage === 'test-lab' && (
            <TestLabPage
              tests={tests}
              activeMode={health?.target_mode || 'mock'}
              loadingTests={loadingTests}
              isRunning={isRunning}
              connections={connections}
              lastLaunchedRun={selectedRun}
              onOpenConnections={() => setIsConnectionsModalOpen(true)}
              onRunTest={handleRunTest}
              onNavigate={navigateTo}
            />
          )}

          {activePage === 'workflow' && (
            <WorkflowPage
              run={selectedRun}
              loading={loadingDetail}
              allRuns={runs}
              onSelectRunId={handleSelectRun}
              onNavigate={navigateTo}
            />
          )}

          {activePage === 'runs' && (
            <RunExplorerPage
              runs={runs}
              total={totalRuns}
              limit={10}
              offset={runOffset}
              hasMore={hasMoreRuns}
              selectedRunId={selectedRunId}
              loading={loadingRuns}
              onSelectRun={handleSelectRun}
              onPageChange={(newOffset) => fetchRuns(newOffset, filters)}
              onRefresh={() => fetchRuns(runOffset, filters)}
              onFilterChange={handleFilterChange}
              onNavigate={navigateTo}
            />
          )}

          {activePage === 'details' && (
            <RunDetailsPage
              run={selectedRun}
              loading={loadingDetail}
              selectedRunId={selectedRunId}
              error={detailError}
              onRetry={handleRetryDetail}
              onRefreshRun={fetchRunDetail}
              onNavigate={navigateTo}
            />
          )}
        </main>
      </div>

      {/* Model Connections Modal */}
      <ModelConnectionsModal
        isOpen={isConnectionsModalOpen}
        onClose={() => setIsConnectionsModalOpen(false)}
        onConnectionsChanged={() => {
          fetchConnections()
        }}
      />
    </div>
  )
}

export default App
