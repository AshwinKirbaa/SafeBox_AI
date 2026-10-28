import React, { useState } from 'react';
import { Icon } from './Effects';

export function SettingsPage({
  settings,
  onSaveSettings,
  onTestLocalServices,
  dockerStatus,
  health,
  busy = false
}) {
  const [timeoutSeconds, setTimeoutSeconds] = useState(settings.timeoutSeconds || 60);
  const [retryCount, setRetryCount] = useState(settings.retryCount || 3);
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://127.0.0.1:11434');
  const [testResult, setTestResult] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    onSaveSettings({
      timeoutSeconds: Number(timeoutSeconds),
      retryCount: Number(retryCount),
      ollamaUrl: ollamaUrl.trim()
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  }

  async function handleTestServices() {
    setTestResult(null);
    try {
      const res = await onTestLocalServices({ ollamaUrl });
      setTestResult({
        ok: true,
        message: res.message || 'All local services responded normally.',
        details: res
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || 'One or more local services are unreachable.'
      });
    }
  }

  return (
    <div className="settings-page-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="eyebrow">SYSTEM CONFIGURATION & TIMINGS</span>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">
            Configure execution parameters, local connectivity URLs, and verify runtime infrastructure readiness.
          </p>
        </div>
      </div>

      {savedNotice && (
        <div className="notification-banner success" role="status">
          <Icon name="check" /> Settings saved successfully.
        </div>
      )}

      {/* Main Settings Form */}
      <section className="settings-card">
        <div className="card-header-line">
          <span className="eyebrow">CORE EXECUTION CONTROLS</span>
          <h3>Execution Parameters</h3>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          {/* Model request timeout */}
          <div className="settings-field-group">
            <label className="field-label eyebrow" htmlFor="model-timeout-input">
              MODEL REQUEST TIMEOUT (SECONDS)
            </label>
            <input
              id="model-timeout-input"
              type="number"
              min={5}
              max={1200}
              className="styled-form-input"
              value={timeoutSeconds}
              onChange={e => setTimeoutSeconds(e.target.value)}
              required
            />
            <span className="field-hint">Maximum time allowed for model inference before timeout.</span>
          </div>

          {/* Retry count */}
          <div className="settings-field-group">
            <label className="field-label eyebrow" htmlFor="retry-count-input">
              RETRY COUNT
            </label>
            <input
              id="retry-count-input"
              type="number"
              min={1}
              max={10}
              className="styled-form-input"
              value={retryCount}
              onChange={e => setRetryCount(e.target.value)}
              required
            />
            <span className="field-hint">Repetitions for test stability and flaky evaluation detection.</span>
          </div>

          {/* Ollama URL */}
          <div className="settings-field-group">
            <label className="field-label eyebrow" htmlFor="ollama-url-input">
              OLLAMA URL
            </label>
            <input
              id="ollama-url-input"
              type="url"
              className="styled-form-input"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              required
            />
            <span className="field-hint">Local Ollama API gateway endpoint.</span>
          </div>

          {/* Docker status */}
          <div className="settings-field-group">
            <span className="field-label eyebrow">DOCKER STATUS</span>
            <div className="docker-status-display">
              <span className={`status-indicator-dot ${dockerStatus === 'Active' || dockerStatus === 'Running' ? 'active' : 'inactive'}`} />
              <div className="docker-info-text">
                <strong>{dockerStatus || 'Active (Container Engine Detected)'}</strong>
                <small>Required for Plane B container isolation probe checks</small>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`service-test-result-box ${testResult.ok ? 'ok' : 'error'}`}>
              <Icon name={testResult.ok ? 'check' : 'close'} />
              <div>
                <strong>{testResult.ok ? 'Local Services Test Passed' : 'Service Check Warning'}</strong>
                <p>{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Buttons: Test Local Services button, Save Settings button */}
          <div className="settings-buttons-strip">
            <button
              type="button"
              className="studio-button secondary"
              onClick={handleTestServices}
              disabled={busy}
            >
              <Icon name="refresh" />
              <span>TEST LOCAL SERVICES</span>
            </button>

            <button
              type="submit"
              className="studio-button primary"
              disabled={busy}
            >
              <span>SAVE SETTINGS</span>
              <Icon name="check" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
