import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from '../App'
import { api } from '../services/api'
import type {
  HealthResponse,
  SecurityTestListResponse,
  RunListResponse,
  RunRecord,
} from '../types/safebox'

describe('Run Selection & Inspection Flow Integration', () => {
  const mockHealth: HealthResponse = {
    status: 'healthy',
    mode: 'mock',
    target_mode: 'mock',
    active_provider: 'mock',
    active_model: 'mock-model',
    version: '1.0.0',
    timestamp: '2026-10-21T00:00:00Z',
    mock_mode: true,
  }

  const mockTests: SecurityTestListResponse = {
    items: [
      {
        test_id: 'canary-disclosure',
        name: 'Canary Disclosure',
        description: 'Tests if canary leaked',
        category: 'leakage',
        version: '1.0.0',
        severity: 'HIGH',
      },
    ],
    total: 1,
  }

  const mockRun1Summary = {
    run_id: 'run_alpha111111111111111111111111',
    state: 'COMPLETED' as const,
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    status: 'PASS' as const,
    target_mode: 'mock' as const,
    model: 'mock-vulnerable',
    provider: 'mock',
    created_at: '2026-10-21T00:01:00Z',
    completed_at: '2026-10-21T00:01:05Z',
  }

  const mockRun2Summary = {
    run_id: 'run_bravo222222222222222222222222',
    state: 'COMPLETED' as const,
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    status: 'FAIL' as const,
    target_mode: 'ollama' as const,
    model: 'llama3.2:3b',
    provider: 'ollama',
    created_at: '2026-10-21T00:02:00Z',
    completed_at: '2026-10-21T00:02:05Z',
  }

  const mockRunsList: RunListResponse = {
    items: [mockRun1Summary, mockRun2Summary],
    total: 2,
    limit: 10,
    offset: 0,
    has_more: false,
  }

  const mockRun1Record: RunRecord = {
    result_type: 'ai_behavior_test',
    run_id: 'run_alpha111111111111111111111111',
    state: 'COMPLETED',
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    target: {
      mode: 'mock',
      adapter: 'mock',
      model: 'mock-vulnerable',
      mock_behavior: 'vulnerable',
    },
    created_at: '2026-10-21T00:01:00Z',
    completed_at: '2026-10-21T00:01:05Z',
    result: {
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      rule_id: 'canary-rule',
      rule_version: '1.0.0',
      status: 'PASS',
      explanation: 'Safely refused Canary',
      evidence_refs: [],
      started_at: '2026-10-21T00:01:00Z',
      completed_at: '2026-10-21T00:01:05Z',
      matched_indicators: [],
      limitations: [],
      repeatability: null,
    },
    evidence: [],
    infrastructure: {
      status: 'PASS',
      checks: [],
      note: 'Verified in Docker non-root sandbox',
    },
  }

  const mockRun2Record: RunRecord = {
    result_type: 'ai_behavior_test',
    run_id: 'run_bravo222222222222222222222222',
    state: 'COMPLETED',
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    target: {
      mode: 'ollama',
      adapter: 'ollama',
      model: 'llama3.2:3b',
      provider: 'ollama',
    },
    created_at: '2026-10-21T00:02:00Z',
    completed_at: '2026-10-21T00:02:05Z',
    result: {
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      rule_id: 'canary-rule',
      rule_version: '1.0.0',
      status: 'FAIL',
      explanation: 'Leaked Canary in response',
      evidence_refs: [],
      started_at: '2026-10-21T00:02:00Z',
      completed_at: '2026-10-21T00:02:05Z',
      matched_indicators: ['canary_disclosure'],
      limitations: [],
      repeatability: null,
    },
    evidence: [],
    infrastructure: {
      status: 'PASS',
      checks: [],
      note: 'Verified in Docker non-root sandbox',
    },
  }

  let scrollIntoViewMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    vi.spyOn(api, 'getHealth').mockResolvedValue(mockHealth)
    vi.spyOn(api, 'getSecurityTests').mockResolvedValue(mockTests)
    vi.spyOn(api, 'getConnections').mockResolvedValue({ items: [] })
    vi.spyOn(api, 'getRuns').mockResolvedValue(mockRunsList)
    vi.spyOn(api, 'getRun').mockImplementation((runId: string) => {
      if (runId === mockRun1Record.run_id) return Promise.resolve(mockRun1Record)
      if (runId === mockRun2Record.run_id) return Promise.resolve(mockRun2Record)
      return Promise.reject(new Error(`Run ${runId} not found`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('automatically selects the latest run on initial load and allows navigating to Run Details', async () => {
    window.location.hash = '#/overview'
    render(<App />)

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('SafeBox AI Defense Platform')).toBeInTheDocument()
    })

    // Latest run (Run 1) is selected and spotlighted on Overview
    await waitFor(() => {
      expect(screen.getByText('run_alpha111111111111111111111111')).toBeInTheDocument()
    })

    // Navigate to Run Explorer via sidebar
    fireEvent.click(screen.getByTestId('nav-runs'))

    // Run Explorer displays Viewing for Run 1 and Inspect for Run 2
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Viewing run run_alpha111111111111111111111111/i,
        })
      ).toBeInTheDocument()
    })

    const inspectButton = screen.getByRole('button', {
      name: /Inspect run run_bravo222222222222222222222222/i,
    })
    expect(inspectButton).toBeInTheDocument()

    // Navigate to Run Details via sidebar
    fireEvent.click(screen.getByTestId('nav-details'))

    await waitFor(() => {
      expect(screen.getByTestId('run-detail-view')).toBeInTheDocument()
    })
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent('MOCK SIMULATOR')
  })

  it('navigates from Run Explorer to Run Details and displays Run 2 when Inspect is clicked', async () => {
    window.location.hash = '#/runs'
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Inspect run run_bravo222222222222222222222222/i,
        })
      ).toBeInTheDocument()
    })

    const inspectButton = screen.getByRole('button', {
      name: /Inspect run run_bravo222222222222222222222222/i,
    })

    // Click Inspect on Run 2 in explorer
    fireEvent.click(inspectButton)

    // Automatically transitions to Run Details page and displays Run 2
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-view')).toBeInTheDocument()
      expect(screen.getByText('run_bravo222222222222222222222222')).toBeInTheDocument()
    })
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent(
      'OLLAMA · llama3.2:3b'
    )
  })

  it('preserves selected run across navigation to Workflow Canvas', async () => {
    window.location.hash = '#/runs'
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Inspect run run_bravo222222222222222222222222/i,
        })
      ).toBeInTheDocument()
    })

    // Inspect Run 2
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect run run_bravo222222222222222222222222/i,
      })
    )

    await waitFor(() => {
      expect(screen.getByText('run_bravo222222222222222222222222')).toBeInTheDocument()
    })

    // Navigate to Workflow page
    fireEvent.click(screen.getByTestId('nav-workflow'))

    // Workflow canvas should load with the selected Run 2 active
    await waitFor(() => {
      expect(screen.getByTestId('workflow-node-origin')).toBeInTheDocument()
    })
    expect(screen.getByText(/OLLAMA · llama3.2:3b/i)).toBeInTheDocument()
  })

  it('displays inline error and allows retry when switching runs encounters an API failure', async () => {
    let callCount = 0
    vi.spyOn(api, 'getRun').mockImplementation((runId: string) => {
      if (runId === mockRun1Record.run_id) return Promise.resolve(mockRun1Record)
      if (runId === mockRun2Record.run_id) {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network timeout fetching run bravo'))
        }
        return Promise.resolve(mockRun2Record)
      }
      return Promise.reject(new Error('Unknown run'))
    })

    window.location.hash = '#/runs'
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Inspect run run_bravo222222222222222222222222/i,
        })
      ).toBeInTheDocument()
    })

    const inspectButton = screen.getByRole('button', {
      name: /Inspect run run_bravo222222222222222222222222/i,
    })
    fireEvent.click(inspectButton)

    // Inline error in detail section appears
    await waitFor(() => {
      expect(screen.getByTestId('detail-inline-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('detail-inline-error')).toHaveTextContent(
      /Network timeout fetching run bravo/i
    )

    // Retry button is available
    const retryBtn = screen.getByTestId('btn-retry-detail')
    fireEvent.click(retryBtn)

    // Second call succeeds and renders Run 2 details
    await waitFor(() => {
      expect(screen.getByText('run_bravo222222222222222222222222')).toBeInTheDocument()
    })
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent(
      'OLLAMA · llama3.2:3b'
    )
    expect(screen.queryByTestId('detail-inline-error')).not.toBeInTheDocument()
  })
})
