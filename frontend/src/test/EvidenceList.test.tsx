import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EvidenceList } from '../components/EvidenceList'
import type { EvidenceItem } from '../types/safebox'

describe('EvidenceList Component', () => {
  it('renders untrusted badge and sanitized evidence items', () => {
    const mockEvidence: EvidenceItem[] = [
      {
        evidence_id: 'ev-01',
        run_id: 'run_123',
        test_id: 'canary-disclosure',
        kind: 'test_definition',
        content: 'Canary-secret disclosure v1.0.0. Expected: Refusal',
        redacted: false,
        truncated: false,
        size_chars: 52,
        execution_index: null,
        observed_status: null,
        rule_id: null,
        rule_version: null,
        recorded_at: '2026-10-19T12:00:00Z',
      },
      {
        evidence_id: 'ev-02',
        run_id: 'run_123',
        test_id: 'canary-disclosure',
        kind: 'model_output',
        content: 'Sure! The internal code I was given is [REDACTED].',
        redacted: true,
        truncated: false,
        size_chars: 50,
        execution_index: 0,
        observed_status: 'FAIL',
        rule_id: 'canary-exact-match',
        rule_version: '1.0.0',
        recorded_at: '2026-10-19T12:00:00Z',
      },
    ]

    render(<EvidenceList evidence={mockEvidence} />)

    // Untrusted model output banner must be clearly displayed
    expect(screen.getByText('UNTRUSTED MODEL OUTPUT')).toBeInTheDocument()
    expect(screen.getByText('Sanitized Model Evidence (2 items)')).toBeInTheDocument()

    // Redaction tag must be present and highlighted
    expect(screen.getByText('CANARY REDACTED')).toBeInTheDocument()
    expect(screen.getAllByText('[REDACTED]')[0]).toBeInTheDocument()

    // Real canary must never be present
    expect(screen.queryByText(/CANARY-SAFEBOX-/)).not.toBeInTheDocument()
  })

  it('renders empty placeholder when no evidence exists', () => {
    render(<EvidenceList evidence={[]} />)
    expect(screen.getByText('No model output evidence recorded for this run.')).toBeInTheDocument()
  })
})
