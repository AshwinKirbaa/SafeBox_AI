import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Header } from './components/Header'
import { TestLauncher } from './components/TestLauncher'
import { RunDetailView } from './components/RunDetailView'
import { RunHistory } from './components/RunHistory'
import { ModelConnectionsModal } from './components/ModelConnectionsModal'
import { api } from './services/api'
import type {
  HealthResponse,
  SecurityTestMeta,
  RunSummary,
  RunRecord,
  RunRequest,
  SavedConnection,
} from './types/safebox'
import { AlertCircle, X } from 'lucide-react'
import './App.css'

export const App: React.FC = () => {
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
  const detailSectionRef = useRef<HTMLElement>(null)

  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null)

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

  // Scroll to detail section
  const scrollToDetail = useCallback(() => {
    if (detailSectionRef.current) {
      if (typeof detailSectionRef.current.scrollIntoView === 'function') {
        detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        const top = detailSectionRef.current.offsetTop - 24
        window.scrollTo({ top: top > 0 ? top : 0, behavior: 'smooth' })
      }
    }
  }, [])

  // Handle run selection with auto-scroll
  const handleSelectRun = useCallback(
    (runId: string) => {
      setSelectedRunId(runId)
      scrollToDetail()
    },
    [scrollToDetail]
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
      scrollToDetail()
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
    <div className="app-layout">
      {/* Top Navigation & Status */}
      <Header
        health={health}
        loadingHealth={loadingHealth}
        healthError={healthError}
        onRefresh={handleRefreshAll}
      />

      <main className="main-content">
        {/* Error Notification Toast */}
        {bannerError && (
          <div className="alert-banner alert-error" role="alert">
            <div className="alert-content">
              <AlertCircle className="alert-icon" />
              <span>{bannerError}</span>
            </div>
            <button
              className="btn-close-alert"
              onClick={() => setBannerError(null)}
              aria-label="Dismiss alert"
            >
              <X className="close-icon" />
            </button>
          </div>
        )}

        {/* Success Notification Toast */}
        {bannerSuccess && (
          <div className="alert-banner alert-success" role="alert">
            <div className="alert-content">
              <span>{bannerSuccess}</span>
            </div>
            <button
              className="btn-close-alert"
              onClick={() => setBannerSuccess(null)}
              aria-label="Dismiss alert"
            >
              <X className="close-icon" />
            </button>
          </div>
        )}

        {/* Top Control Section: Test Launcher */}
        <section className="launcher-section">
          <TestLauncher
            tests={tests}
            activeMode={health?.target_mode || 'mock'}
            loadingTests={loadingTests}
            isRunning={isRunning}
            connections={connections}
            onOpenConnections={() => setIsConnectionsModalOpen(true)}
            onRunTest={handleRunTest}
          />
        </section>

        {/* Primary View: Two Independent Security Result Panels */}
        <section ref={detailSectionRef} id="active-run-detail" className="detail-section">
          <RunDetailView
            run={selectedRun}
            loading={loadingDetail}
            selectedRunId={selectedRunId}
            error={detailError}
            onRetry={handleRetryDetail}
            onRefreshRun={fetchRunDetail}
          />
        </section>

        {/* Bottom Section: Run History Explorer */}
        <section className="history-section">
          <RunHistory
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
          />
        </section>
      </main>

      {/* Model Connections Management Modal */}
      <ModelConnectionsModal
        isOpen={isConnectionsModalOpen}
        onClose={() => setIsConnectionsModalOpen(false)}
        onConnectionsChanged={() => {
          fetchConnections()
        }}
      />

      {/* Footer */}
      <footer className="footer-container">
        <p>
          SafeBox AI &bull; Universal Model Security Evaluation &bull; Independent Isolation Planes
        </p>
        <span className="footer-links">
          Strict Redaction Enforced &bull; Deterministic Rules &bull; SSRF Protection &bull; Container Non-Root Isolation
        </span>
      </footer>
    </div>
  )
}

export default App
