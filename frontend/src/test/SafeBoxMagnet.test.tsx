import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SafeBoxMagnet } from '../components/SafeBoxMagnet'

describe('SafeBoxMagnet Component', () => {
  beforeEach(() => {
    // Standard mock matchMedia returning false by default (fine pointer, no reduced motion)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

  it('renders children properly inside polymorphic element', () => {
    const { container, unmount } = render(
      <SafeBoxMagnet className="test-magnet-wrap">
        <button type="button">Launch Security Test</button>
      </SafeBoxMagnet>
    )

    const button = screen.getByRole('button', { name: /Launch Security Test/i })
    expect(button).toBeInTheDocument()

    const wrapper = container.querySelector('.test-magnet-wrap')
    expect(wrapper).toHaveClass('safebox-magnet')

    unmount()
  })

  it('allows click events and keyboard triggers through to children', () => {
    const handleClick = vi.fn()
    const { unmount } = render(
      <SafeBoxMagnet>
        <button type="button" onClick={handleClick}>
          Run Evaluation
        </button>
      </SafeBoxMagnet>
    )

    const button = screen.getByRole('button', { name: /Run Evaluation/i })
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('honors disabled prop and attaches disabled class', () => {
    const { container, unmount } = render(
      <SafeBoxMagnet disabled={true}>
        <button type="button">Disabled Magnet</button>
      </SafeBoxMagnet>
    )

    const wrapper = container.querySelector('.safebox-magnet')
    expect(wrapper).toHaveClass('safebox-magnet--disabled')

    unmount()
  })

  it('detects prefers-reduced-motion and attaches reduced-motion class', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { container, unmount } = render(
      <SafeBoxMagnet>
        <button type="button">Accessible Action</button>
      </SafeBoxMagnet>
    )

    const wrapper = container.querySelector('.safebox-magnet')
    expect(wrapper).toHaveClass('safebox-magnet--reduced-motion')

    unmount()
  })

  it('detects touch/coarse pointers and suppresses active magnetism', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: coarse') || query.includes('hover: none'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { container, unmount } = render(
      <SafeBoxMagnet>
        <button type="button">Touch Safe Action</button>
      </SafeBoxMagnet>
    )

    const wrapper = container.querySelector('.safebox-magnet')
    expect(wrapper).toHaveClass('safebox-magnet--reduced-motion')

    unmount()
  })

  it('resets displacement to origin on keyboard focus for visible focus rings', () => {
    const { container, unmount } = render(
      <SafeBoxMagnet>
        <button type="button">Focusable Action</button>
      </SafeBoxMagnet>
    )

    const wrapper = container.querySelector('.safebox-magnet') as HTMLElement
    expect(wrapper).toBeInTheDocument()

    // Trigger focus
    fireEvent.focus(wrapper)
    expect(wrapper.style.getPropertyValue('--magnet-x')).toBe('0px')
    expect(wrapper.style.getPropertyValue('--magnet-y')).toBe('0px')

    unmount()
  })

  it('supports multiple nearby magnets without interference or exceptions', () => {
    const { container, unmount } = render(
      <div className="test-button-group">
        <SafeBoxMagnet maxDisplacement={6} range={80}>
          <button type="button">Button Alpha</button>
        </SafeBoxMagnet>
        <SafeBoxMagnet maxDisplacement={6} range={80}>
          <button type="button">Button Bravo</button>
        </SafeBoxMagnet>
      </div>
    )

    const magnets = container.querySelectorAll('.safebox-magnet')
    expect(magnets.length).toBe(2)

    // Simulate pointer move over document
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 })

    expect(screen.getByRole('button', { name: /Button Alpha/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Button Bravo/i })).toBeInTheDocument()

    unmount()
  })
})
