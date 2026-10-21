import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModelConnectionsModal } from '../components/ModelConnectionsModal'
import { api } from '../services/api'
import type { ProviderMeta, SavedConnection } from '../types/safebox'

vi.mock('../services/api', () => ({
  api: {
    getProviders: vi.fn(),
    getConnections: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    testConnection: vi.fn(),
  },
}))

const mockProviders: ProviderMeta[] = [
  {
    id: 'openai_compatible',
    name: 'OpenAI-Compatible API',
    tier: 'A',
    description: 'Any inference server implementing the /v1/chat/completions API.',
    default_base_url: 'https://api.openai.com/v1',
    requires_api_key: true,
    supports_model_discovery: true,
    supported_modalities: ['text', 'structured_output', 'tool_calling'],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    tier: 'A',
    description: 'Local Ollama server running on localhost:11434.',
    default_base_url: 'http://localhost:11434',
    default_model: 'llama3.2:3b',
    requires_api_key: false,
    supports_model_discovery: true,
    supported_modalities: ['text', 'vision'],
  },
]

const mockConnections: SavedConnection[] = [
  {
    connection_id: 'conn-1',
    name: 'My Custom Ollama',
    provider: 'ollama',
    model: 'llama3.2:3b',
    base_url: 'http://localhost:11434',
    created_at: 1700000000,
    has_api_key: false,
    capabilities: {
      text: true,
      vision: true,
      audio: false,
      structured_output: false,
      tool_calling: false,
      streaming: false,
    },
  },
]

describe('ModelConnectionsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getProviders).mockResolvedValue(mockProviders)
    vi.mocked(api.getConnections).mockResolvedValue({ items: mockConnections, count: 1 })
  })

  it('renders modal when open and displays existing connections and providers', async () => {
    render(
      <ModelConnectionsModal
        isOpen={true}
        onClose={vi.fn()}
        onConnectionsChanged={vi.fn()}
      />
    )

    expect(screen.getByText(/Model Connections/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('My Custom Ollama')).toBeInTheDocument()
      expect(screen.getByText('llama3.2:3b')).toBeInTheDocument()
    })
  })

  it('allows testing a connection and displays discovery chips', async () => {
    vi.mocked(api.testConnection).mockResolvedValue({
      reachable: true,
      latency_ms: 45,
      discovered_models: ['llama3.2:3b', 'mistral:7b'],
      capabilities: {
        text: true,
        vision: false,
        audio: false,
        structured_output: false,
        tool_calling: false,
        streaming: false,
      },
    })

    render(
      <ModelConnectionsModal
        isOpen={true}
        onClose={vi.fn()}
        onConnectionsChanged={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Test Connection & Discover/i)).toBeInTheDocument()
    })

    const testBtn = screen.getByText(/Test Connection & Discover/i)
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(screen.getByText(/Reachable/i)).toBeInTheDocument()
      expect(screen.getByText('mistral:7b')).toBeInTheDocument()
    })
  })
})
