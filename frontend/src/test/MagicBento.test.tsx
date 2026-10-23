import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MagicBento from '../components/MagicBento'

describe('MagicBento Component', () => {
  beforeEach(() => {
    // Mock matchMedia
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

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      root = null
      rootMargin = ''
      thresholds = []
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
    } as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders default items and their titles', () => {
    const { container, unmount } = render(
      <MagicBento
        columns={4}
        rowHeight={200}
        gap={15}
        radius={20}
        disableAnimations={true}
        enableBorderGlow={true}
        enableSpotlight={true}
        spotlightRadius={300}
        clickEffect={true}
      />
    )

    const root = container.querySelector('.magic-bento')
    expect(root).toBeInTheDocument()

    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Collaboration')).toBeInTheDocument()
    expect(screen.getByText('Automation')).toBeInTheDocument()
    expect(screen.getByText('Integration')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()

    unmount()
  })

  it('renders custom items and triggers onItemClick', () => {
    const onItemClick = vi.fn()
    const customItems = [
      {
        id: 'feat-1',
        title: 'Dual-Plane Engine',
        description: 'Simultaneous AI model and sandbox verification',
        label: 'CORE'
      },
      {
        id: 'feat-2',
        title: '7 Sandbox Probes',
        description: 'Verifies read-only rootfs, no-new-privs, seccomp',
        label: 'ISOLATION'
      }
    ]

    const { unmount } = render(
      <MagicBento
        items={customItems}
        columns={2}
        disableAnimations={true}
        theme="dark"
        glowColor="#38bdf8"
        onItemClick={onItemClick}
      />
    )

    expect(screen.getByText('Dual-Plane Engine')).toBeInTheDocument()
    expect(screen.getByText('7 Sandbox Probes')).toBeInTheDocument()
    expect(screen.getByText('CORE')).toBeInTheDocument()
    expect(screen.getByText('ISOLATION')).toBeInTheDocument()

    const card = screen.getByText('Dual-Plane Engine').closest('.magic-bento__card')
    expect(card).toBeInTheDocument()
    if (card) {
      fireEvent.click(card)
      expect(onItemClick).toHaveBeenCalledWith(customItems[0], 0)
    }

    unmount()
  })

  it('renders with links for href items', () => {
    const linkItems = [
      {
        title: 'Documentation',
        description: 'Learn platform architecture',
        href: 'https://docs.safebox.local',
        target: '_blank'
      }
    ]

    const { unmount } = render(<MagicBento items={linkItems} columns={1} disableAnimations={true} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://docs.safebox.local')
    expect(link).toHaveAttribute('target', '_blank')

    unmount()
  })
})
