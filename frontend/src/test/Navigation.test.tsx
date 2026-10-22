import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from '../App'
import { api } from '../services/api'
import type {
  HealthResponse,
  SecurityTestListResponse,
  RunListResponse,
  RunRecord,
} from '../types/safebox'

describe('Multi-Page Navigation & App Shell', () => {
  const mockHealth: HealthResponse = {
    status: 'healthy',
    mode: 'mock',
    target_mode: 'mock',
    active_provider: 'mock',
    active_model: 'mock-model',
    version: '1.0.0',
    timestamp: '2026-10-21T00:00:00Z',
    mock_mode: true,
    database_ok: true,
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

  const mockRun: RunRecord = {
    result_type: 'ai_behavior_test',
    run_id: 'run_test_route_1234567890123456',
    state: 'COMPLETED',
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    target: {
      mode: 'mock',
      adapter: 'mock',
      model: 'mock-model',
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
      checks: [
        {
          check_id: 'docker-socket-absence',
          name: 'Docker Socket Absence',
          policy_id: 'no-docker-socket',
          status: 'PASS',
          observed: 'No socket found',
          expected: 'Socket absent',
        },
      ],
      note: 'Verified in Docker sandbox',
    },
  }

  const mockRunsList: RunListResponse = {
    items: [
      {
        run_id: mockRun.run_id,
        state: 'COMPLETED',
        test_id: 'canary-disclosure',
        test_version: '1.0.0',
        status: 'PASS',
        target_mode: 'mock',
        model: 'mock-model',
        provider: 'mock',
        created_at: '2026-10-21T00:01:00Z',
        completed_at: '2026-10-21T00:01:05Z',
      },
    ],
    total: 1,
    limit: 10,
    offset: 0,
    has_more: false,
  }

  beforeEach(() => {
    vi.spyOn(api, 'getHealth').mockResolvedValue(mockHealth)
    vi.spyOn(api, 'getSecurityTests').mockResolvedValue(mockTests)
    vi.spyOn(api, 'getConnections').mockResolvedValue({ items: [] })
    vi.spyOn(api, 'getRuns').mockResolvedValue(mockRunsList)
    vi.spyOn(api, 'getRun').mockResolvedValue(mockRun)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders sidebar and topbar with navigation destinations', async () => {
    window.location.hash = '#/overview'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SafeBox AI Defense Platform')).toBeInTheDocument()
    })

    // Sidebar items
    expect(screen.getByTestId('nav-overview')).toBeInTheDocument()
    expect(screen.getByTestId('nav-test-lab')).toBeInTheDocument()
    expect(screen.getByTestId('nav-workflow')).toBeInTheDocument()
    expect(screen.getByTestId('nav-runs')).toBeInTheDocument()
    expect(screen.getByTestId('nav-details')).toBeInTheDocument()
    expect(screen.getByTestId('nav-model-connections')).toBeInTheDocument()

    // TopBar and Sidebar status pills
    expect(screen.getByText(/SQLITE:/i)).toBeInTheDocument()
    expect(screen.getAllByText('CONNECTED').length).toBeGreaterThanOrEqual(1)
  })

  it('navigates to Test Lab and displays TestLauncher without full run evidence stack', async () => {
    window.location.hash = '#/overview'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SafeBox AI Defense Platform')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('nav-test-lab'))

    await waitFor(() => {
      expect(screen.getByText('Security Test Control & Adversarial Launcher')).toBeInTheDocument()
    })

    // Does NOT render RunDetailView or RunHistory on TestLab page
    expect(screen.queryByTestId('run-detail-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('runs-history-table')).not.toBeInTheDocument()
  })

  it('navigates to Workflow page and renders interactive canvas', async () => {
    window.location.hash = '#/overview'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SafeBox AI Defense Platform')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('nav-workflow'))

    await waitFor(() => {
      expect(screen.getByText('SafeBox Dual-Plane Topology')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-node-origin')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-node-junction')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-node-ai')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-node-docker')).toBeInTheDocument()
    })
  })

  it('opens Model Connections modal when clicked from sidebar', async () => {
    window.location.hash = '#/overview'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SafeBox AI Defense Platform')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('nav-model-connections'))

    await waitFor(() => {
      expect(screen.getByText(/Model Connections/i)).toBeInTheDocument()
    })
  })
})
