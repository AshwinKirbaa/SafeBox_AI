import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { InfraIsolationPanel } from '../components/InfraIsolationPanel'
import { api } from '../services/api'
import type { InfrastructureSummary } from '../types/safebox'

describe('InfraIsolationPanel Component', () => {
  it('renders all seven standard infrastructure checks with MISSING status when unverified', () => {
    const mockSummary: InfrastructureSummary = {
      result_type: 'infrastructure_isolation',
      status: 'MISSING',
      checks: [],
      note: 'Reported by sandbox worker.',
    }

    render(<InfraIsolationPanel infrastructure={mockSummary} runId="run_abc123" />)

    // Explanatory banner
    expect(screen.getByText('Not Verified (No Worker Checks Submitted Yet)')).toBeInTheDocument()

    // Worker command helper must be shown
    expect(
      screen.getByText('powershell -ExecutionPolicy Bypass -File worker/run_worker.ps1 -RunId run_abc123')
    ).toBeInTheDocument()

    // All 7 check rows must be individually present
    expect(screen.getByTestId('infra-check-docker-socket-absence')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-non-root-execution')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-dropped-capabilities')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-resource-limits')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-workspace-isolation')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-host-filesystem-protection')).toBeInTheDocument()
    expect(screen.getByTestId('infra-check-network-egress')).toBeInTheDocument()

    // Missing checks must never display as PASS
    expect(screen.queryByText('ISOLATION PASS')).not.toBeInTheDocument()
  })

  it('renders submitted check observations, expected policies, and evidence references', () => {
    const mockSummary: InfrastructureSummary = {
      result_type: 'infrastructure_isolation',
      status: 'PASS',
      note: 'All checks passed.',
      checks: [
        {
          worker_id: 'worker-1',
          run_id: 'run_abc123',
          check_id: 'docker-socket-absence',
          policy_id: 'no-docker-socket',
          policy_version: '1.0.0',
          reported_state: 'COMPLETED',
          observed: 'docker socket absent at all probe locations',
          expected: 'docker socket absent at all probe locations',
          evidence_ref: 'probe:docker-socket',
          timestamp: '2026-10-19T12:00:00Z',
          error: null,
          limitation: null,
          status: 'PASS',
          received_at: '2026-10-19T12:00:01Z',
          result_type: 'infrastructure_isolation',
        },
      ],
    }

    render(<InfraIsolationPanel infrastructure={mockSummary} runId="run_abc123" />)

    expect(screen.getAllByText('docker socket absent at all probe locations').length).toBe(2)
    expect(screen.getByText('probe:docker-socket')).toBeInTheDocument()
  })

  it('renders launch worker button and triggers api.launchWorker on click', async () => {
    const mockSummary: InfrastructureSummary = {
      result_type: 'infrastructure_isolation',
      status: 'MISSING',
      checks: [],
      note: 'Reported by sandbox worker.',
    }
    const refreshSpy = vi.fn()
    const launchSpy = vi.spyOn(api, 'launchWorker').mockResolvedValueOnce({} as any)

    render(<InfraIsolationPanel infrastructure={mockSummary} runId="run_abc123" onRefreshRun={refreshSpy} />)

    const launchBtn = screen.getByTestId('btn-launch-worker')
    expect(launchBtn).toBeInTheDocument()
    expect(screen.getByText('Launch Worker Verification')).toBeInTheDocument()

    fireEvent.click(launchBtn)
    await waitFor(() => {
      expect(launchSpy).toHaveBeenCalledWith('run_abc123', false)
    })
  })

  it('displays actionable troubleshooting error if Docker is unavailable', async () => {
    const mockSummary: InfrastructureSummary = {
      result_type: 'infrastructure_isolation',
      status: 'MISSING',
      checks: [],
      note: 'Reported by sandbox worker.',
    }
    vi.spyOn(api, 'launchWorker').mockRejectedValueOnce(
      new Error('Docker Desktop daemon is stopped or not running (daemon offline).')
    )

    render(<InfraIsolationPanel infrastructure={mockSummary} runId="run_abc123" />)

    const launchBtn = screen.getByTestId('btn-launch-worker')
    fireEvent.click(launchBtn)

    expect(await screen.findByTestId('worker-execution-error')).toBeInTheDocument()
    expect(
      screen.getByText(/Docker Desktop daemon is stopped or unreachable/i)
    ).toBeInTheDocument()
    expect(screen.getByTestId('btn-launch-fallback')).toBeInTheDocument()
  })
})
