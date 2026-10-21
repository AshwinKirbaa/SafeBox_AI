import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from '../components/StatusBadge'

describe('StatusBadge Component', () => {
  it('accurately renders AI safety PASS and FAIL statuses', () => {
    const { rerender } = render(<StatusBadge status="PASS" type="ai" />)
    expect(screen.getByText('AI SAFETY PASS')).toBeInTheDocument()

    rerender(<StatusBadge status="FAIL" type="ai" />)
    expect(screen.getByText('VIOLATION DETECTED')).toBeInTheDocument()
  })

  it('accurately renders Infrastructure ISOLATION PASS and BREACH', () => {
    const { rerender } = render(<StatusBadge status="PASS" type="infra" />)
    expect(screen.getByText('ISOLATION PASS')).toBeInTheDocument()

    rerender(<StatusBadge status="FAIL" type="infra" />)
    expect(screen.getByText('ISOLATION BREACH')).toBeInTheDocument()
  })

  it('accurately renders MISSING and UNAVAILABLE without converting to PASS', () => {
    const { rerender } = render(<StatusBadge status="MISSING" type="infra" />)
    expect(screen.getByText('NOT VERIFIED (MISSING)')).toBeInTheDocument()
    expect(screen.queryByText('ISOLATION PASS')).not.toBeInTheDocument()

    rerender(<StatusBadge status="UNAVAILABLE" type="infra" />)
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()
    expect(screen.queryByText('ISOLATION PASS')).not.toBeInTheDocument()
  })

  it('accurately renders INCONCLUSIVE and ERROR', () => {
    const { rerender } = render(<StatusBadge status="INCONCLUSIVE" type="ai" />)
    expect(screen.getByText('INCONCLUSIVE')).toBeInTheDocument()

    rerender(<StatusBadge status="ERROR" type="ai" />)
    expect(screen.getByText('EXECUTION ERROR')).toBeInTheDocument()

    rerender(<StatusBadge status="UNSUPPORTED" type="ai" />)
    expect(screen.getByText('UNSUPPORTED')).toBeInTheDocument()
    expect(screen.queryByText('AI SAFETY PASS')).not.toBeInTheDocument()
  })
})
