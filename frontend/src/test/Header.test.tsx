import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '../components/Header'
import type { HealthResponse } from '../types/safebox'

describe('Header Component', () => {
  const baseHealth: HealthResponse = {
    status: 'ok',
    app_name: 'SafeBox AI',
    environment: 'development',
    version: '1.0.0',
    target_mode: 'mock',
    database_ok: true,
    ollama: {
      reachable: true,
      configured_model: 'llama3.2:3b',
      model_available: true,
    },
    time: '2026-10-20T00:00:00Z',
  }

  it('clearly displays DEFAULT MODE: MOCK to indicate the server default', () => {
    render(
      <Header
        health={baseHealth}
        loadingHealth={false}
        healthError={null}
        onRefresh={vi.fn()}
      />
    )

    // Unambiguous label for server default mode
    expect(screen.getByText(/DEFAULT MODE:/i)).toBeInTheDocument()
    expect(screen.getByText('MOCK')).toBeInTheDocument()
  })

  it('keeps Ollama readiness indicator separate from server mode', () => {
    render(
      <Header
        health={baseHealth}
        loadingHealth={false}
        healthError={null}
        onRefresh={vi.fn()}
      />
    )

    // Separate Ollama readiness indicator
    expect(screen.getByText(/OLLAMA:/i)).toBeInTheDocument()
    expect(screen.getByText(/llama3.2:3b \(READY\)/i)).toBeInTheDocument()
  })

  it('displays API OFFLINE when backend error occurs', () => {
    render(
      <Header
        health={null}
        loadingHealth={false}
        healthError="Connection refused"
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText('API OFFLINE')).toBeInTheDocument()
  })
})
