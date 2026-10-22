import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RunDetailView } from '../components/RunDetailView'
import type { RunRecord } from '../types/safebox'

describe('RunDetailView Component', () => {
  const createMockRun = (targetMode: 'mock' | 'ollama', model: string, mockBehavior?: any): RunRecord => ({
    result_type: 'ai_behavior_test',
    run_id: 'run_test1234567890123456789012345678',
    state: 'COMPLETED',
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    target: {
      mode: targetMode,
      adapter: targetMode,
      model: model,
      mock_behavior: mockBehavior,
    },
    created_at: '2026-10-20T00:00:00Z',
    completed_at: '2026-10-20T00:00:05Z',
    result: {
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      rule_id: 'canary-exact-match',
      rule_version: '1.0.0',
      status: 'PASS',
      explanation: 'Target refused disclosure safely.',
      evidence_refs: [],
      started_at: '2026-10-20T00:00:00Z',
      completed_at: '2026-10-20T00:00:05Z',
      matched_indicators: ['canary_absent', 'refusal_phrase_present'],
      limitations: [],
      repeatability: null,
    },
    evidence: [],
    infrastructure: {
      status: 'MISSING',
      checks: [],
      note: 'No worker verification submitted',
    },
  })

  it('prominently displays OLLAMA · llama3.2:3b for live model runs', () => {
    const run = createMockRun('ollama', 'llama3.2:3b')

    render(<RunDetailView run={run} loading={false} />)

    // Check prominent target badge and chip
    const badge = screen.getByTestId('active-run-target-badge')
    expect(badge).toHaveTextContent('OLLAMA · llama3.2:3b')

    const chip = screen.getByTestId('active-run-target-chip')
    expect(chip).toHaveTextContent('OLLAMA · llama3.2:3b')
  })

  it('prominently displays MOCK SIMULATOR for mock runs', () => {
    const run = createMockRun('mock', 'mock-vulnerable', 'vulnerable')

    render(<RunDetailView run={run} loading={false} />)

    const badge = screen.getByTestId('active-run-target-badge')
    expect(badge).toHaveTextContent('MOCK SIMULATOR')

    const chip = screen.getByTestId('active-run-target-chip')
    expect(chip).toHaveTextContent('MOCK SIMULATOR')
  })

  it('never labels a mock result as a real model result even with custom model name', () => {
    const run = createMockRun('mock', 'llama3.2:3b', 'defended')
    render(<RunDetailView run={run} loading={false} />)

    const badge = screen.getByTestId('active-run-target-badge')
    expect(badge).toHaveTextContent('MOCK SIMULATOR')
    expect(badge).not.toHaveTextContent('OLLAMA')

    const chip = screen.getByTestId('active-run-target-chip')
    expect(chip).toHaveTextContent('MOCK SIMULATOR')
    expect(chip).toHaveTextContent('[Simulated Mock]')
    expect(chip).not.toHaveTextContent('[Live Model]')
  })

  it('renders initial loading placeholder when loading with no run', () => {
    render(<RunDetailView run={null} loading={true} selectedRunId="run_pending123" />)
    expect(screen.getByTestId('detail-initial-loading')).toBeInTheDocument()
    expect(screen.getByText(/Loading security audit record/i)).toBeInTheDocument()
    expect(screen.getByText(/run_pending123/)).toBeInTheDocument()
  })

  it('renders error card and triggers onRetry when initial load fails', () => {
    let retried = false
    render(
      <RunDetailView
        run={null}
        loading={false}
        error="Network error fetching run"
        onRetry={() => {
          retried = true
        }}
      />
    )
    expect(screen.getByTestId('detail-error-card')).toBeInTheDocument()
    expect(screen.getByText('Network error fetching run')).toBeInTheDocument()

    const retryBtn = screen.getByTestId('btn-retry-detail')
    retryBtn.click()
    expect(retried).toBe(true)
  })

  it('displays in-flight transition loading badge and chip when switching to a different run', () => {
    const run = createMockRun('mock', 'mock-vulnerable')
    render(
      <RunDetailView
        run={run}
        loading={true}
        selectedRunId="run_new_in_flight_456"
      />
    )

    // Current run's details are still safely visible
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent('MOCK SIMULATOR')

    // In-flight indicator is active
    expect(screen.getByTestId('active-run-loading-badge')).toBeInTheDocument()
    expect(screen.getByTestId('active-run-loading-chip')).toBeInTheDocument()

    // Panel grid has transitioning class
    const wrapper = screen.getByTestId('run-detail-view')
    expect(wrapper).toHaveClass('panels-transitioning')
  })

  it('renders inline error banner with retry option if fetching newly selected run fails', () => {
    const run = createMockRun('ollama', 'llama3.2:3b')
    let retried = false
    render(
      <RunDetailView
        run={run}
        loading={false}
        selectedRunId="run_failed_switch_789"
        error="Failed to load run run_failed_switch_789: 500 Server Error"
        onRetry={() => {
          retried = true
        }}
      />
    )

    // Existing run is still visible
    expect(screen.getByText(run.run_id)).toBeInTheDocument()

    // Inline error banner is present
    expect(screen.getByTestId('detail-inline-error')).toBeInTheDocument()
    expect(
      screen.getByText('Failed to load run run_failed_switch_789: 500 Server Error')
    ).toBeInTheDocument()

    const retryBtn = screen.getByTestId('btn-retry-detail')
    retryBtn.click()
    expect(retried).toBe(true)
  })

  it('updates properly when switched to a second run', () => {
    const run1 = createMockRun('mock', 'mock-model-1')
    run1.run_id = 'run_00000000000000000000000000000001'

    const run2 = createMockRun('ollama', 'llama3.2:3b')
    run2.run_id = 'run_00000000000000000000000000000002'

    const { rerender } = render(
      <RunDetailView run={run1} loading={false} selectedRunId={run1.run_id} />
    )
    expect(screen.getByText(run1.run_id)).toBeInTheDocument()
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent('MOCK SIMULATOR')

    // Transitioning state
    rerender(
      <RunDetailView run={run1} loading={true} selectedRunId={run2.run_id} />
    )
    expect(screen.getByTestId('active-run-loading-badge')).toBeInTheDocument()

    // Second run completed
    rerender(
      <RunDetailView run={run2} loading={false} selectedRunId={run2.run_id} />
    )
    expect(screen.getByText(run2.run_id)).toBeInTheDocument()
    expect(screen.getByTestId('active-run-target-badge')).toHaveTextContent('OLLAMA · llama3.2:3b')
    expect(screen.queryByTestId('active-run-loading-badge')).not.toBeInTheDocument()
  })

  it('prominently displays GEMINI · gemini-3.5-flash for Gemini runs and never MOCK SIMULATOR', () => {
    const geminiRun: RunRecord = {
      result_type: 'ai_behavior_test',
      run_id: 'run_gemini123456789012345678901234',
      state: 'COMPLETED',
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      target: {
        mode: 'gemini',
        provider: 'gemini',
        adapter: 'gemini',
        model: 'gemini-3.5-flash',
        connection_id: 'conn_gemini_test',
        is_remote: true,
      },
      created_at: '2026-10-21T00:00:00Z',
      completed_at: '2026-10-21T00:00:05Z',
      result: {
        test_id: 'canary-disclosure',
        test_version: '1.0.0',
        rule_id: 'canary-exact-match',
        rule_version: '1.0.0',
        status: 'PASS',
        explanation: 'Refused canary safely.',
        evidence_refs: [],
        started_at: '2026-10-21T00:00:00Z',
        completed_at: '2026-10-21T00:00:05Z',
        matched_indicators: [],
        limitations: [],
      },
      evidence: [],
      infrastructure: {
        status: 'MISSING',
        checks: [],
        note: 'Independent check',
      },
    }

    render(<RunDetailView run={geminiRun} loading={false} />)

    const badge = screen.getByTestId('active-run-target-badge')
    expect(badge).toHaveTextContent('GEMINI · gemini-3.5-flash')
    expect(badge).not.toHaveTextContent('MOCK SIMULATOR')

    const chip = screen.getByTestId('active-run-target-chip')
    expect(chip).toHaveTextContent('GEMINI · gemini-3.5-flash')
    expect(chip).toHaveTextContent('[Live Model]')
    expect(chip).not.toHaveTextContent('[Simulated Mock]')
  })
})
