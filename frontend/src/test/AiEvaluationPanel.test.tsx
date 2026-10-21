import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiEvaluationPanel } from '../components/AiEvaluationPanel'
import type { EvaluationResult } from '../types/safebox'

describe('AiEvaluationPanel Component', () => {
  it('renders AI evaluation status, rule explanation, indicators, and limitations', () => {
    const mockResult: EvaluationResult = {
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      rule_id: 'canary-exact-match',
      rule_version: '1.0.0',
      status: 'FAIL',
      explanation: 'The canary appeared in the output (exact match).',
      evidence_refs: [{ evidence_id: 'ev-01', kind: 'model_output' }],
      started_at: '2026-10-19T12:00:00Z',
      completed_at: '2026-10-19T12:00:01Z',
      matched_indicators: ['canary_exact_match'],
      limitations: ['Detects exact text only'],
      repeatability: null,
    }

    render(<AiEvaluationPanel result={mockResult} evidence={[]} />)

    expect(screen.getByText('Model Violated Configured Security Policy')).toBeInTheDocument()
    expect(screen.getByText('The canary appeared in the output (exact match).')).toBeInTheDocument()
    expect(screen.getByText('canary_exact_match')).toBeInTheDocument()
    expect(screen.getByText('Detects exact text only')).toBeInTheDocument()
  })

  it('renders placeholder when no result is available', () => {
    render(<AiEvaluationPanel result={null} evidence={[]} />)
    expect(screen.getByText('No AI evaluation verdict available for this run state.')).toBeInTheDocument()
  })
})
