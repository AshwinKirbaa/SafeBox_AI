import React, { useState } from 'react';
import { Icon, Emblem } from './Effects';
import { TYPES, TYPE_LABELS, runPayload } from './api';
import { getCandidateModelsForType, getEligibleTests, isModelCompatibleWithType } from './test-lab-contracts';

/* Compatibility helpers live in test-lab-contracts.js so UI and tests share one contract. */
/*
export function isModelCompatibleWithType(modelName, type, connection = null, probes = {}) {
  const probeKey = connection ? `${connection.connection_id}|${modelName}|${type}` : '';
  if (probes[probeKey] && probes[probeKey].compatible != null) {
    return probes[probeKey].compatible;
  }

  const name = (modelName || '').toLowerCase();

  switch (type) {
    case 'embedding':
      return name.includes('embed') || name.includes('bge') || name.includes('ada') || name.includes('nomic') || name.includes('minilm') || name.includes('e5');
    case 'image_generation':
      return name.includes('flux') || name.includes('dall-e') || name.includes('diffusion') || name.includes('sdxl') || name.includes('imagen');
    case 'speech_to_text':
      return name.includes('whisper') || name.includes('stt') || name.includes('transcribe');
    case 'text_to_speech':
      return name.includes('tts') || name.includes('speech') || name.includes('voice');
    case 'vision':
      return name.includes('vision') || name.includes('4o') || name.includes('claude-3') || name.includes('gemini') || name.includes('llava') || name.includes('bakllava');
    case 'chat':
      // General LLM unless specialized in pure embedding/audio/image
      if (name.includes('embed') || name.includes('whisper') || name.includes('flux') || name.includes('tts')) {
        return false;
      }
      return true;
    default:
      return true;
  }
} */

export function TestLabPage({
  connections = [],
  discovery = {},
  probes = {},
  tests = [],
  health,
  onNavigate,
  onRunTest,
  onRunContractTest,
  onDiscoverModels,
  busy = false,
  handoffModel = null
}) {
  const [modelType, setModelType] = useState('chat');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [validationError, setValidationError] = useState('');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [contractResult, setContractResult] = useState(null);

  // Discovery proves that a provider exposes a model; the live contract probe proves its type.
  // Do not hide a provider merely because a model identifier has no modality keyword.
  const filteredConnections = connections.filter(conn => {
    const discovered = discovery[conn.connection_id] || [];
    return getCandidateModelsForType(discovered, modelType, conn, probes).length > 0;
  });

  // Effective connection
  const activeConn = filteredConnections.find(c => c.connection_id === selectedConnectionId) || filteredConnections[0];
  const activeConnId = activeConn ? activeConn.connection_id : '';

  // Compatible models for active connection
  const activeDiscovered = activeConn ? (discovery[activeConnId] || []) : [];
  const compatibleModels = getCandidateModelsForType(activeDiscovered, modelType, activeConn, probes);
  const verifiedCompatibleCount = compatibleModels.filter(m => isModelCompatibleWithType(m, modelType, activeConn, probes)).length;
  const activeModel = compatibleModels.includes(selectedModel) ? selectedModel : (compatibleModels[0] || '');

  // Compatible tests for this model type
  const eligibleTests = getEligibleTests(tests, modelType);
  const activeTestId = eligibleTests.some(t => t.test_id === selectedTestId)
    ? selectedTestId
    : (eligibleTests[0]?.test_id || '');

  const activeTest = eligibleTests.find(t => t.test_id === activeTestId);

  // Execution environment indicator: local vs cloud
  const isLocalExecution = activeConn
    ? (!activeConn.is_remote && (activeConn.provider === 'ollama' || (activeConn.base_url || '').includes('127.0.0.1') || (activeConn.base_url || '').includes('localhost')))
    : false;

  async function handleRunClick() {
    setValidationError('');
    if (!activeConnId) {
      setValidationError('Please select or configure a connection with discovered compatible models.');
      return;
    }
    if (!activeModel) {
      setValidationError('Please select a compatible model version.');
      return;
    }
    if (!activeTestId) {
      setValidationError('Please select a compatible security test.');
      return;
    }

    try {
      if (activeTest?.is_contract_probe) {
        const result = await onRunContractTest({ connection_id: activeConnId, provider: activeConn.provider, model: activeModel, model_type: modelType });
        setContractResult(result);
        if (!result?.compatible) setValidationError(result?.error_message || result?.explanation || `The selected model did not satisfy the ${TYPE_LABELS[modelType]} contract.`);
        return;
      }
      const payload = runPayload({
        testId: activeTestId,
        connectionId: activeConnId,
        model: activeModel,
        type: modelType,
        timeout: 60
      });
      await onRunTest(payload);
    } catch (err) {
      setValidationError(err.message || 'Execution error');
    }
  }

  async function handleRefreshModels() {
    if (activeConnId) {
      setValidationError('');
      try {
        await onDiscoverModels(activeConnId);
      } catch (e) {
        setValidationError(`Discovery failed: ${e.message}`);
      }
    }
  }

  return (
    <div className="test-lab-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="eyebrow">TYPE-AWARE EVALUATION WORKBENCH</span>
          <h2 className="page-title">SafeBox Test Lab</h2>
          <p className="page-subtitle">Select a target model contract and execute registered security boundary tests.</p>
        </div>
        <div className="page-header-actions">
          <button className="studio-button secondary" onClick={() => onNavigate('providers')}>
            <Icon name="compare" /> <span>MANAGE CONNECTIONS</span>
          </button>
        </div>
      </div>

      {/* Main Test Lab Form: EXACT ORDER SPECIFIED */}
      <div className="test-lab-workbench-card">
        <div className="form-card-header">
          <span className="eyebrow">TARGET CONFIGURATION & TEST SELECTION</span>
          <h3>Target Definition</h3>
        </div>

        <div className="test-lab-controls-list">
          {/* 1. AI Model Type dropdown */}
          <div className="control-group">
            <label className="control-label eyebrow" htmlFor="model-type-dropdown">
              1. AI MODEL TYPE
            </label>
            <select
              id="model-type-dropdown"
              className="styled-lab-dropdown"
              value={modelType}
              onChange={e => {
                setModelType(e.target.value);
                setSelectedModel('');
                setSelectedTestId('');
                setContractResult(null);
                setValidationError('');
              }}
            >
              {TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <span className="control-hint">Select inference modality and contract.</span>
          </div>

          {/* 2. Connection Name dropdown */}
          <div className="control-group">
            <label className="control-label eyebrow" htmlFor="connection-name-dropdown">
              2. CONNECTION NAME
            </label>
            <select
              id="connection-name-dropdown"
              className="styled-lab-dropdown"
              value={activeConnId}
              onChange={e => {
                setSelectedConnectionId(e.target.value);
                setSelectedModel('');
                setContractResult(null);
                setValidationError('');
                setContractResult(null);
              }}
              disabled={filteredConnections.length === 0}
            >
              {filteredConnections.length === 0 ? (
                <option value="">No saved connection has discovered model candidates</option>
              ) : (
                filteredConnections.map(c => (
                  <option key={c.connection_id} value={c.connection_id}>
                    {c.name} ({c.provider})
                  </option>
                ))
              )}
            </select>
            <span className="control-hint">
              {filteredConnections.length === 0
                ? 'Verify and discover models from Model Providers first.'
                : `${filteredConnections.length} connection(s) available. Type compatibility is confirmed by the selected contract test.`}
            </span>
          </div>

          {/* 3. Model Version dropdown */}
          <div className="control-group">
            <label className="control-label eyebrow" htmlFor="model-version-dropdown">
              3. MODEL VERSION
            </label>
            <select
              id="model-version-dropdown"
              className="styled-lab-dropdown"
              value={activeModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                setValidationError('');
              }}
              disabled={compatibleModels.length === 0}
            >
              {compatibleModels.length === 0 ? (
                <option value="">No compatible models discovered for this connection</option>
              ) : (
                compatibleModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </select>
            <span className="control-hint">
              {compatibleModels.length
                ? `${compatibleModels.length} discovered candidate(s); ${verifiedCompatibleCount} recognized or previously verified for ${TYPE_LABELS[modelType]}.`
                : 'Discover models via Manage Connections.'}
            </span>
          </div>

          {/* 4. Compatible Security Test dropdown */}
          <div className="control-group">
            <label className="control-label eyebrow" htmlFor="security-test-dropdown">
              4. COMPATIBLE SECURITY TEST
            </label>
            <select
              id="security-test-dropdown"
              className="styled-lab-dropdown"
              value={activeTestId}
              onChange={e => {
                setSelectedTestId(e.target.value);
                setValidationError('');
              }}
              disabled={eligibleTests.length === 0}
            >
              {eligibleTests.length === 0 ? (
                <option value="">No compatible security tests registered for this capability</option>
              ) : (
                eligibleTests.map(t => (
                  <option key={t.test_id} value={t.test_id}>
                    {t.name} ({t.test_id})
                  </option>
                ))
              )}
            </select>
            <span className="control-hint">{activeTest?.is_contract_probe ? 'Type-specific live API contract probe.' : 'Deterministic behavioral security test registered on the backend.'}</span>
          </div>
        </div>

        {/* Additional Information Section */}
        <div className="test-additional-info-panel">
          <div className="info-sub-row">
            <div className="execution-indicator-badge">
              <span className="eyebrow">EXECUTION PLANE</span>
              <span className={`plane-badge ${isLocalExecution ? 'local' : 'cloud'}`}>
                {isLocalExecution ? '● Local Execution (Ollama / Local Container)' : '▲ Cloud Execution (Remote Provider API)'}
              </span>
            </div>

            {activeTest && (
              <div className="test-meta-badge">
                <span className="eyebrow">TEST CATEGORY</span>
                <span className="badge-val">{activeTest.category || 'Adversarial Prompting'}</span>
              </div>
            )}
          </div>

          {activeTest && (
            <div className="info-detail-box">
              <div className="detail-item">
                <span className="eyebrow">TEST DESCRIPTION</span>
                <p>{activeTest.description}</p>
              </div>

              <div className="detail-item">
                <span className="eyebrow">EXPECTED SECURE BEHAVIOUR</span>
                <p className="expected-text">
                  <Icon name="shield" /> {activeTest.expected_behavior}
                </p>
              </div>
            </div>
          )}

          {/* Validation / error message */}
          {validationError && (
            <div className="validation-error-banner" role="alert">
              <Icon name="close" />
              <span>{validationError}</span>
            </div>
          )}
          {contractResult?.compatible === true && (
            <div className="validation-success-banner" role="status"><Icon name="shield" /><span>Contract verified for {TYPE_LABELS[modelType]}. Latency: {contractResult.latency_ms ?? 'N/A'} ms.</span></div>
          )}
        </div>

        {/* Action Buttons: Run Selected Test, View Test Details, Manage Connections, Refresh Models */}
        <div className="test-lab-buttons-row">
          <button
            className="studio-button primary"
            onClick={handleRunClick}
            disabled={busy || !activeConnId || !activeModel || !activeTestId}
          >
            <span>{busy ? 'EXECUTING SECURITY TEST...' : 'RUN SELECTED TEST'}</span>
            <Icon name="diagonal" />
          </button>

          <button
            className="studio-button secondary"
            onClick={() => setDetailsModalOpen(true)}
            disabled={!activeTest}
          >
            <span>VIEW TEST DETAILS</span>
            <Icon name="search" />
          </button>

          <button
            className="studio-button secondary"
            onClick={() => onNavigate('providers')}
          >
            <span>MANAGE CONNECTIONS</span>
            <Icon name="compare" />
          </button>

          <button
            className="studio-button secondary"
            onClick={handleRefreshModels}
            disabled={busy || !activeConnId}
          >
            <span>REFRESH MODELS</span>
            <Icon name="refresh" />
          </button>
        </div>
      </div>

      {/* Test Details Modal */}
      {detailsModalOpen && activeTest && (
        <div className="product-modal-shade" role="dialog" aria-modal="true">
          <section className="product-modal">
            <button className="close-modal-btn" onClick={() => setDetailsModalOpen(false)} aria-label="Close">
              <Icon name="close" />
            </button>
            <span className="eyebrow">SECURITY TEST SPECIFICATION</span>
            <h2>{activeTest.name}</h2>
            <div className="modal-body-content">
              <div className="modal-field">
                <span className="eyebrow">TEST IDENTIFIER</span>
                <code>{activeTest.test_id} (version: {activeTest.version || '1.0.0'})</code>
              </div>

              <div className="modal-field">
                <span className="eyebrow">DESCRIPTION</span>
                <p>{activeTest.description}</p>
              </div>

              <div className="modal-field">
                <span className="eyebrow">EXPECTED SECURE BEHAVIOUR</span>
                <p>{activeTest.expected_behavior}</p>
              </div>

              <div className="modal-field">
                <span className="eyebrow">EVALUATION RULE ID</span>
                <code>{activeTest.rule_id} v{activeTest.rule_version}</code>
              </div>

              {activeTest.limitations && activeTest.limitations.length > 0 && (
                <div className="modal-field">
                  <span className="eyebrow">KNOWN LIMITATIONS & SCOPE</span>
                  <ul className="limitations-list">
                    {activeTest.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer-row">
              <button className="studio-button primary" onClick={() => setDetailsModalOpen(false)}>
                <span>CLOSE DETAILS</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
