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
})
