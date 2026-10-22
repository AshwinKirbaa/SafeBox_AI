import type {
  HealthResponse,
  SecurityTestListResponse,
  RunRequest,
  RunRecord,
  RunListResponse,
  ApiErrorResponse,
  ProviderMeta,
  SavedConnection,
  ConnectionCreatePayload,
  ConnectionUpdatePayload,
  ConnectionTestRequest,
  ConnectionTestResponse,
  ConnectionLiveVerifyRequest,
  ConnectionLiveVerifyResponse,
} from '../types/safebox'

const BASE_URL = ''

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`
    try {
      const errJson = (await res.json()) as ApiErrorResponse
      if (errJson.error) {
        errorMessage = errJson.error.message || errJson.error.code
        if (errJson.error.details && errJson.error.details.length > 0) {
          const detailMsgs = errJson.error.details
            .map((d) => `${d.loc.join('.')}: ${d.msg}`)
            .join('; ')
          errorMessage += ` (${detailMsgs})`
        }
      }
    } catch {
      // not json
    }
    throw new Error(errorMessage)
  }
  return res.json() as Promise<T>
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<HealthResponse>(res)
  },

  async getSecurityTests(): Promise<SecurityTestListResponse> {
    const res = await fetch(`${BASE_URL}/api/security-tests`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<SecurityTestListResponse>(res)
  },

  async runSecurityTest(req: RunRequest): Promise<RunRecord> {
    const res = await fetch(`${BASE_URL}/api/security-tests/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req),
    })
    return handleResponse<RunRecord>(res)
  },

  async getRuns(
    limit = 20,
    offset = 0,
    filters?: { provider?: string; model?: string; status?: string }
  ): Promise<RunListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    if (filters?.provider) params.append('provider', filters.provider)
    if (filters?.model) params.append('model', filters.model)
    if (filters?.status) params.append('status', filters.status)

    const res = await fetch(
      `${BASE_URL}/api/security-tests/runs?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
      }
    )
    return handleResponse<RunListResponse>(res)
  },

  async getRun(runId: string): Promise<RunRecord> {
    const res = await fetch(`${BASE_URL}/api/security-tests/runs/${runId}`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<RunRecord>(res)
  },

  async launchWorker(
    runId: string,
    allowHostFallback = false
  ): Promise<RunRecord> {
    const query = allowHostFallback ? '?allow_host_fallback=true' : ''
    const res = await fetch(
      `${BASE_URL}/api/security-tests/runs/${runId}/launch-worker${query}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }
    )
    return handleResponse<RunRecord>(res)
  },

  // Model Connections & Provider Discovery Endpoints
  async getProviders(): Promise<ProviderMeta[]> {
    const res = await fetch(`${BASE_URL}/api/connections/providers`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<ProviderMeta[]>(res)
  },

  async getConnections(): Promise<{ items: SavedConnection[] }> {
    const res = await fetch(`${BASE_URL}/api/connections`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<{ items: SavedConnection[] }>(res)
  },

  async createConnection(data: ConnectionCreatePayload): Promise<SavedConnection> {
    const res = await fetch(`${BASE_URL}/api/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<SavedConnection>(res)
  },

  async updateConnection(
    connectionId: string,
    data: ConnectionUpdatePayload
  ): Promise<SavedConnection> {
    const res = await fetch(`${BASE_URL}/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<SavedConnection>(res)
  },

  async deleteConnection(connectionId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/connections/${connectionId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      throw new Error(`Failed to delete connection: ${res.statusText}`)
    }
  },

  async testConnection(data: ConnectionTestRequest): Promise<ConnectionTestResponse> {
    const res = await fetch(`${BASE_URL}/api/connections/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<ConnectionTestResponse>(res)
  },

  async discoverModels(connectionId: string): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/api/connections/${connectionId}/models`, {
      headers: { Accept: 'application/json' },
    })
    return handleResponse<string[]>(res)
  },

  async verifyConnectionLive(
    data: ConnectionLiveVerifyRequest
  ): Promise<ConnectionLiveVerifyResponse> {
    const res = await fetch(`${BASE_URL}/api/connections/verify-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<ConnectionLiveVerifyResponse>(res)
  },
}
