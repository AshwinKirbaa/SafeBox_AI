import React, { useState, useEffect } from 'react'
import {
  X,
  Server,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import { api } from '../services/api'
import type {
  ProviderMeta,
  SavedConnection,
  ConnectionTestResponse,
  ConnectionLiveVerifyResponse,
  ConnectionLiveVerifyRequest,
} from '../types/safebox'

interface ModelConnectionsModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionsChanged: () => void
}

export const ModelConnectionsModal: React.FC<ModelConnectionsModalProps> = ({
  isOpen,
  onClose,
  onConnectionsChanged,
}) => {
  const [providers, setProviders] = useState<ProviderMeta[]>([])
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Edit / Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [provider, setProvider] = useState<string>('openai_compatible')
  const [model, setModel] = useState<string>('')
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)

  // Test connection state
  const [testing, setTesting] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<ConnectionTestResponse | null>(null)
  const [saving, setSaving] = useState<boolean>(false)

  // Live verification state
  const [verifying, setVerifying] = useState<boolean>(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [liveVerifyResult, setLiveVerifyResult] = useState<ConnectionLiveVerifyResponse | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [provData, connData] = await Promise.all([
          api.getProviders(),
          api.getConnections(),
        ])
        if (!ignore) {
          setProviders(provData)
          setConnections(connData.items)
          if (provData.length > 0) {
            setProvider((prev) => prev || provData[0].id)
          }
        }
      } catch (err) {
        if (!ignore) setError((err as Error).message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [isOpen])

  // When provider changes, populate sensible defaults
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const meta = providers.find((p) => p.id === newProvider)
    if (meta) {
      if (meta.default_model && !model) setModel(meta.default_model)
      if (meta.default_base_url && !baseUrl) setBaseUrl(meta.default_base_url)
    }
    setTestResult(null)
    setLiveVerifyResult(null)
  }

  const handleStartEdit = (conn: SavedConnection) => {
    setEditingId(conn.connection_id)
    setName(conn.name)
    setProvider(conn.provider)
    setModel(conn.model)
    setBaseUrl(conn.base_url || '')
    setApiKey('') // Never expose stored key; entering text updates it
    setTestResult(null)
    setLiveVerifyResult(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setName('')
    setModel('')
    setBaseUrl('')
    setApiKey('')
    setTestResult(null)
    setLiveVerifyResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setLiveVerifyResult(null)
    try {
      const res = await api.testConnection({
        provider,
        model: model.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        connection_id: editingId || undefined,
      })
      setTestResult(res)
    } catch (err) {
      setTestResult({
        reachable: false,
        error_message: (err as Error).message,
        discovered_models: [],
      })
    } finally {
      setTesting(false)
    }
  }

  const handleLiveVerify = async (connId?: string) => {
    setVerifying(true)
    setVerifyingId(connId || null)
    setLiveVerifyResult(null)
    setTestResult(null)
    setError(null)
    try {
      let payload: ConnectionLiveVerifyRequest
      if (connId) {
        payload = { connection_id: connId, test_id: 'canary-disclosure' }
      } else {
        payload = {
          connection_id: editingId || undefined,
          target: {
            provider,
            model: model.trim() || undefined,
            base_url: baseUrl.trim() || undefined,
            api_key: apiKey.trim() || undefined,
          },
          test_id: 'canary-disclosure',
        }
      }
      const res = await api.verifyConnectionLive(payload)
      setLiveVerifyResult(res)
      if (res.inference_executed) {
        onConnectionsChanged()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setVerifying(false)
      setVerifyingId(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !model.trim()) {
      setError('Please provide a connection name and model identifier.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.updateConnection(editingId, {
          name: name.trim(),
          model: model.trim(),
          base_url: baseUrl.trim() || null,
          api_key: apiKey.trim() || undefined,
        })
      } else {
        await api.createConnection({
          name: name.trim(),
          provider,
          model: model.trim(),
          base_url: baseUrl.trim() || null,
          api_key: apiKey.trim() || undefined,
        })
      }
      // Refresh list
      const updated = await api.getConnections()
      setConnections(updated.items)
      handleCancelEdit()
      onConnectionsChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to remove this connection?')) return
    try {
      await api.deleteConnection(connectionId)
      const updated = await api.getConnections()
      setConnections(updated.items)
      onConnectionsChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!isOpen) return null

  const selectedMeta = providers.find((p) => p.id === provider)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Server className="modal-title-icon" />
            <div>
              <h3>Model Connections & Integrations</h3>
              <p className="modal-subtitle">
                Configure local or remote AI models, custom endpoints, and API authentication.
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close dialog">
            <X className="icon-sm" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="modal-body">
          {error && (
            <div className="alert-banner alert-error mb-4">
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Form to Add / Edit Connection */}
          <form onSubmit={handleSave} className="connection-form-card">
            <h4>{editingId ? 'Edit Model Connection' : 'Add New Model Connection'}</h4>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Connection Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. OpenAI Production v4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inference Provider</label>
                <select
                  className="form-select"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={!!editingId}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.tier}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Model Identifier</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. gpt-4o-mini or meta-llama/Llama-3.2-3B"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
                {selectedMeta && (
                  <span className="text-xs text-muted">
                    Default: {selectedMeta.default_model || 'Custom'}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Base URL {selectedMeta?.requires_base_url && <strong className="text-amber">*</strong>}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={selectedMeta?.default_base_url || 'https://api.openai.com/v1'}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            </div>

            {/* API Key field if provider uses credentials */}
            <div className="form-group mt-3">
              <label className="form-label">
                API Key / Secret Token {selectedMeta?.requires_api_key && <strong className="text-amber">*</strong>}
              </label>
              <div className="password-input-group">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  placeholder={
                    editingId
                      ? 'Leave blank to preserve existing stored credential'
                      : 'sk-... or Bearer Token (masked in storage)'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide secret' : 'Show secret'}
                >
                  {showKey ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Security Policy: Secrets are encrypted/vaulted server-side and never returned in API responses.
              </p>
            </div>

            {/* Test Connection Button & Result Box */}
            <div className="connection-test-row mt-3">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleTest}
                disabled={testing || verifying}
              >
                {testing ? (
                  <>
                    <RefreshCw className="icon-xs spin" />
                    Testing Reachability...
                  </>
                ) : (
                  <>
                    <Zap className="icon-xs text-amber" />
                    Test Connection & Discover
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleLiveVerify()}
                disabled={verifying || testing || !model.trim()}
                title="Execute real inference and run security evaluation"
              >
                {verifying && !verifyingId ? (
                  <>
                    <RefreshCw className="icon-xs spin" />
                    Running Live Verification...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="icon-xs text-emerald" />
                    Live Audit & Verify
                  </>
                )}
              </button>

              <div className="form-actions">
                {editingId && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-primary btn-sm"
                  disabled={saving || !name.trim() || !model.trim()}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Connection' : 'Save Connection'}
                </button>
              </div>
            </div>

            {/* Live Verification Feedback Banner */}
            {liveVerifyResult && (
              <div
                className={`test-result-banner mt-3 ${
                  liveVerifyResult.verdict === 'PASS'
                    ? 'result-success'
                    : liveVerifyResult.verdict === 'FAIL' || liveVerifyResult.error_message
                    ? 'result-failure'
                    : 'result-inconclusive'
                }`}
              >
                <div className="result-header">
                  {liveVerifyResult.verdict === 'PASS' ? (
                    <CheckCircle className="result-icon text-emerald" />
                  ) : (
                    <AlertCircle className="result-icon text-amber" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <strong>
                        Live Verification: {liveVerifyResult.provider.toUpperCase()} · {liveVerifyResult.model}
                      </strong>
                      {liveVerifyResult.verdict && (
                        <span className={`badge-pill badge-${liveVerifyResult.verdict.toLowerCase()}`}>
                          {liveVerifyResult.verdict}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1">
                      {liveVerifyResult.inference_executed ? (
                        <span>
                          Real inference verified · Latency: {liveVerifyResult.observed_latency_ms ?? 0}ms
                          {liveVerifyResult.token_usage?.total_tokens &&
                            ` · Tokens: ${liveVerifyResult.token_usage.total_tokens}`}
                          {liveVerifyResult.run_id && ` · Run: ${liveVerifyResult.run_id}`}
                        </span>
                      ) : (
                        <span className="text-red">
                          {liveVerifyResult.error_message || 'Endpoint unreachable or authentication failed.'}
                        </span>
                      )}
                    </div>
                    {liveVerifyResult.explanation && (
                      <p className="text-xs text-muted mt-1">{liveVerifyResult.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Live Test Feedback Banner */}
            {testResult && (
              <div
                className={`test-result-banner mt-3 ${
                  testResult.reachable ? 'result-success' : 'result-failure'
                }`}
              >
                <div className="result-header">
                  {testResult.reachable ? (
                    <CheckCircle className="result-icon text-emerald" />
                  ) : (
                    <AlertCircle className="result-icon text-red" />
                  )}
                  <span>
                    {testResult.reachable
                      ? `Reachable · Latency: ${testResult.latency_ms ?? 0}ms · Model ${
                          testResult.model_available ? 'Verified' : 'Check Pending'
                        }`
                      : `Connection Failed: ${testResult.error_message || 'Unreachable'}`}
                  </span>
                </div>

                {testResult.capabilities && (
                  <div className="capabilities-tags mt-2">
                    <span className="text-xs font-semibold mr-2">Supported Capabilities:</span>
                    {Object.entries(testResult.capabilities).map(([cap, enabled]) => (
                      <span
                        key={cap}
                        className={`cap-tag ${enabled ? 'cap-enabled' : 'cap-disabled'}`}
                      >
                        {cap}: {enabled ? 'YES' : 'NO'}
                      </span>
                    ))}
                  </div>
                )}

                {testResult.discovered_models && testResult.discovered_models.length > 0 && (
                  <div className="discovered-models-list mt-2">
                    <span className="text-xs font-semibold">
                      Discovered Models ({testResult.discovered_models.length}):
                    </span>
                    <div className="models-chips-scroll">
                      {testResult.discovered_models.slice(0, 8).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="chip-model-btn"
                          onClick={() => setModel(m)}
                          title="Click to use this model identifier"
                        >
                          {m}
                        </button>
                      ))}
                      {testResult.discovered_models.length > 8 && (
                        <span className="text-xs text-muted">
                          +{testResult.discovered_models.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* List of Saved Connections */}
          <div className="saved-connections-section mt-5">
            <h4>Saved Target Connections ({connections.length})</h4>
            {loading ? (
              <div className="spinner-small" />
            ) : connections.length === 0 ? (
              <p className="text-sm text-muted">
                No custom connections saved yet. Add one using the form above or use Ollama / Mock default modes.
              </p>
            ) : (
              <div className="connections-grid">
                {connections.map((c) => (
                  <div key={c.connection_id} className="connection-card">
                    <div className="conn-card-header">
                      <div>
                        <strong>{c.name}</strong>
                        <span className="provider-pill ml-2">{c.provider}</span>
                      </div>
                      <div className="conn-card-actions">
                        <button
                          className="btn-ghost-sm text-xs mr-2"
                          onClick={() => handleLiveVerify(c.connection_id)}
                          disabled={verifying && verifyingId === c.connection_id}
                          title="Run live inference and security evaluation on this saved connection"
                        >
                          {verifying && verifyingId === c.connection_id ? (
                            <>
                              <RefreshCw className="icon-xs spin mr-1" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="icon-xs text-emerald mr-1" />
                              Verify Live
                            </>
                          )}
                        </button>
                        <button
                          className="btn-icon-mini"
                          onClick={() => handleStartEdit(c)}
                          title="Edit connection"
                        >
                          <Edit2 className="icon-xs" />
                        </button>
                        <button
                          className="btn-icon-mini text-red"
                          onClick={() => handleDelete(c.connection_id)}
                          title="Delete connection"
                        >
                          <Trash2 className="icon-xs" />
                        </button>
                      </div>
                    </div>
                    <div className="conn-card-details">
                      <div className="detail-item">
                        <span className="detail-label">Model:</span>
                        <code>{c.model}</code>
                      </div>
                      {c.base_url && (
                        <div className="detail-item">
                          <span className="detail-label">Base URL:</span>
                          <span className="text-xs text-muted truncate">{c.base_url}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <span className="detail-label">Credentials:</span>
                        <span className="text-xs">
                          {c.has_api_key ? (
                            <span className="text-emerald">Configured ({c.masked_api_key})</span>
                          ) : (
                            <span className="text-muted">None (Open/Local)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
