import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TargetCursor } from '../components/TargetCursor'

describe('TargetCursor Component', () => {
  beforeEach(() => {
    // Mock matchMedia for fine pointer and reduced motion
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover') || query.includes('pointer: fine'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders portal in document.body with corners, center dot, and label element', () => {
    const { unmount } = render(
      <TargetCursor
        targetSelector=".cursor-target"
        cursorColor="#38bdf8"
        cursorColorOnTarget="#38bdf8"
        spinDuration={2}
      />
    )

    const cursorRoot = document.querySelector('.target-cursor')
    expect(cursorRoot).toBeInTheDocument()

    const corners = document.querySelectorAll('.target-cursor__corner')
    expect(corners.length).toBe(4)

    const dot = document.querySelector('.target-cursor__dot')
    expect(dot).toBeInTheDocument()

    const label = document.querySelector('.target-cursor__label')
    expect(label).toBeInTheDocument()

    unmount()
    expect(document.querySelector('.target-cursor')).not.toBeInTheDocument()
  })

  it('safely handles non-fine pointer devices by not rendering portal', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(<TargetCursor />)
    const cursorRoot = document.querySelector('.target-cursor')
    expect(cursorRoot).toBeNull()
  })
})
