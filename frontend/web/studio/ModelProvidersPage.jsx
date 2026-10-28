import React, { useState } from 'react';
import { Icon, Emblem } from './Effects';
import { buildConnectionPayload } from './connection-payload';

export function ModelProvidersPage({
  connections = [],
  providers = [],
  discovery = {},
  onSaveConnection,
  onDeleteConnection,
  onVerifyAndDiscover,
  onVerifySavedConnection,
  busy = false,
  notification = '',
  initialProvider = ''
}) {
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState(initialProvider || 'ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [formFeedback, setFormFeedback] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // When changing provider, default baseUrl if empty
  function handleProviderChange(newProviderId) {
    setProvider(newProviderId);
    const meta = providers.find(p => p.id === newProviderId);
    if (meta && meta.default_base_url && !baseUrl) {
      setBaseUrl(meta.default_base_url);
    }
  }

  function handleEditClick(c) {
    setEditId(c.connection_id);
    setName(c.name);
    setProvider(c.provider);
    setBaseUrl(c.base_url || '');
    setSecret('');
    setShowSecret(false);
    setFormFeedback('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancel() {
    setEditId('');
    setName('');
    setProvider('ollama');
    setBaseUrl('');
    setSecret('');
    setShowSecret(false);
    setFormFeedback('');
  }

  async function handleVerifyAndDiscover() {
    setFormFeedback('');
    if (!name.trim()) {
      setFormFeedback('Please enter a Connection Name before verifying.');
      return;
    }
    try {
      const res = await onVerifyAndDiscover({
        name,
        provider,
        base_url: baseUrl,
        api_key: secret,
        connection_id: editId || undefined
      });
      const count = res.discovered_models ? res.discovered_models.length : 0;
      setFormFeedback(`Verification successful: Reachable (${res.latency_ms ?? 12}ms). Discovered ${count} model(s).`);
    } catch (err) {
      setFormFeedback(`Verification failed: ${err.message}`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormFeedback('');
    if (!name.trim()) {
      setFormFeedback('Connection Name is required.');
      return;
    }

    try {
      await onSaveConnection(
        buildConnectionPayload({ name, provider, baseUrl, secret, editId }),
        editId || null
      );
      handleCancel();
    } catch (err) {
      setFormFeedback(`Save failed: ${err.message}`);
    }
  }

  return (
    <div className="model-providers-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="eyebrow">INFERENCE SOURCE INTEGRATIONS</span>
          <h2 className="page-title">Model Providers</h2>
          <p className="page-subtitle">
            Connect SafeBox to model providers. SafeBox automatically discovers available models and validates inference contracts.
          </p>
        </div>
      </div>

      {notification && (
        <div className="notification-banner" role="status">
          <Icon name="check" /> {notification}
        </div>
      )}

      {/* Connection Form Card */}
      <section className="connection-form-card">
        <div className="card-header-line">
          <span className="eyebrow">{editId ? 'EDIT CONFIGURATION' : 'NEW CONNECTION PROFILE'}</span>
          <h3>{editId ? `Update Connection: ${name}` : 'Connect an Inference Provider'}</h3>
          <p className="card-desc">
            Credentials are securely encrypted in SafeBox. Model versions and capabilities are discovered automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="provider-connection-form">
          {/* Connection Name textbox */}
          <div className="form-control-block">
            <label className="field-label eyebrow" htmlFor="conn-name-input">
              CONNECTION NAME
            </label>
            <input
              id="conn-name-input"
              type="text"
              className="styled-form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Local Ollama Gateway or OpenAI Production"
              maxLength={64}
              required
            />
          </div>

          {/* Inference Provider dropdown */}
          <div className="form-control-block">
            <label className="field-label eyebrow" htmlFor="provider-select">
              INFERENCE PROVIDER
            </label>
            <select
              id="provider-select"
              className="styled-form-dropdown"
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              disabled={!!editId}
            >
              {providers.length > 0 ? (
                providers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_remote ? '(Cloud)' : '(Local)'}
                  </option>
                ))
              ) : (
                <>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI (Cloud)</option>
                  <option value="anthropic">Anthropic (Cloud)</option>
                  <option value="gemini">Google Gemini (Cloud)</option>
                  <option value="openrouter">OpenRouter (Cloud)</option>
                  <option value="huggingface">Hugging Face (Cloud)</option>
                  <option value="generic_http">Generic HTTP / vLLM</option>
                </>
              )}
            </select>
          </div>

          {/* Base URL textbox */}
          <div className="form-control-block">
            <label className="field-label eyebrow" htmlFor="base-url-input">
              BASE URL
            </label>
            <input
              id="base-url-input"
              type="url"
              className="styled-form-input"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1 or http://127.0.0.1:11434"
            />
            <span className="field-hint">Leave blank for official cloud provider API defaults.</span>
          </div>

          {/* API Key/Secret textbox & Show/Hide Secret button */}
          <div className="form-control-block">
            <div className="label-with-action">
              <label className="field-label eyebrow" htmlFor="api-secret-input">
                API KEY / SECRET {editId && <small>(Leave blank to retain stored secret)</small>}
              </label>
              <button
                type="button"
                className="toggle-secret-btn"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? 'HIDE SECRET' : 'SHOW SECRET'}
              </button>
            </div>
            <input
              id="api-secret-input"
              type={showSecret ? 'text' : 'password'}
              autoComplete="off"
              className="styled-form-input"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder={editId ? '••••••••••••••••' : 'Enter API secret key or bearer token'}
            />
          </div>

          {formFeedback && (
            <div className="form-feedback-message">
              <Icon name="diagonal" /> {formFeedback}
            </div>
          )}

          {/* Buttons: Verify Connection & Discover Models, Save/Update Connection, Cancel */}
          <div className="form-buttons-strip">
            <button
              type="button"
              className="studio-button secondary"
              onClick={handleVerifyAndDiscover}
              disabled={busy}
            >
              <Icon name="search" />
              <span>VERIFY CONNECTION & DISCOVER MODELS</span>
            </button>

            <button
              type="submit"
              className="studio-button primary"
              disabled={busy}
            >
              <span>{editId ? 'UPDATE CONNECTION' : 'SAVE CONNECTION'}</span>
              <Icon name="check" />
            </button>

            <button
              type="button"
              className="studio-button secondary"
              onClick={handleCancel}
              disabled={busy}
            >
              <span>CANCEL</span>
              <Icon name="close" />
            </button>
          </div>
        </form>
      </section>

      {/* Saved Connection Cards Section */}
      <section className="saved-connections-section">
        <div className="section-head-row">
          <div>
            <span className="eyebrow">CONFIGURED PROVIDER PROFILES</span>
            <h3>Saved Connections ({connections.length})</h3>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="empty-connections-box">
            <p>No model connections configured yet. Use the form above to add your first provider account.</p>
          </div>
        ) : (
          <div className="connections-grid">
            {connections.map(c => {
              const discoveredModels = discovery[c.connection_id] || [];
              const modelCount = discoveredModels.length;
              return (
                <div key={c.connection_id} className="saved-connection-card">
                  <div className="card-top">
                    <div>
                      <h4 className="connection-title">{c.name}</h4>
                      <span className="provider-tag eyebrow">{c.provider.toUpperCase()}</span>
                    </div>
                    <span className={`status-pill-badge ${modelCount > 0 ? 'verified' : 'configured'}`}>
                      {modelCount > 0 ? '● Verified & Ready' : '○ Pending Discovery'}
                    </span>
                  </div>

                  <div className="connection-details-table">
                    <div className="detail-row">
                      <span className="eyebrow">BASE URL</span>
                      <span className="monospace text-truncate">{c.base_url || 'Default Cloud Endpoint'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="eyebrow">CREDENTIAL STATUS</span>
                      <span>{c.has_api_key ? '● Secret Stored (Encrypted)' : '○ No Secret Stored'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="eyebrow">DISCOVERED MODELS</span>
                      <span className="font-bold text-accent">{modelCount} model(s) discovered</span>
                    </div>
                  </div>

                  {modelCount > 0 && (
                    <div className="discovered-preview-strip">
                      <span className="eyebrow">MODELS:</span>
                      <div className="tags-cloud">
                        {discoveredModels.slice(0, 4).map(m => (
                          <span key={m} className="model-chip">{m}</span>
                        ))}
                        {discoveredModels.length > 4 && (
                          <span className="model-chip-more">+{discoveredModels.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Buttons: Edit, Delete, Verify */}
                  <div className="connection-card-actions">
                    <button
                      className="card-action-btn"
                      onClick={() => handleEditClick(c)}
                      disabled={busy}
                    >
                      <Icon name="compare" /> Edit
                    </button>
                    <button
                      className="card-action-btn delete"
                      onClick={() => setDeleteConfirmId(c.connection_id)}
                      disabled={busy}
                    >
                      <Icon name="close" /> Delete
                    </button>
                    <button
                      className="card-action-btn verify"
                      onClick={() => onVerifySavedConnection(c.connection_id)}
                      disabled={busy}
                    >
                      <Icon name="refresh" /> Verify
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="product-modal-shade" role="alertdialog" aria-modal="true">
          <section className="product-modal">
            <span className="eyebrow">CONFIRM DELETION</span>
            <h2>Delete Connection?</h2>
            <p>
              Are you sure you want to remove this connection profile from SafeBox? Discovered models and test associations will be cleared.
            </p>
            <div className="modal-footer-row">
              <button className="studio-button secondary" onClick={() => setDeleteConfirmId(null)}>
                <span>CANCEL</span>
              </button>
              <button
                className="studio-button primary"
                onClick={() => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  onDeleteConnection(id);
                }}
              >
                <span>CONFIRM DELETE</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
