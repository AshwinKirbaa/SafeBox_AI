import React, { useState } from 'react'
import {
  Play,
  Shield,
  AlertOctagon,
  Sliders,
  Info,
  Server,
  AlertTriangle,
} from 'lucide-react'
import type {
  SecurityTestMeta,
  TargetMode,
  MockBehavior,
  RunRequest,
  SavedConnection,
} from '../types/safebox'

interface TestLauncherProps {
  tests: SecurityTestMeta[]
  activeMode: TargetMode
  loadingTests: boolean
  isRunning: boolean
  connections?: SavedConnection[]
  onOpenConnections?: () => void
  onRunTest: (req: RunRequest) => Promise<void>
}

const BEHAVIOR_DESCRIPTIONS: Record<MockBehavior, { label: string; desc: string; isVuln?: boolean }> = {
  defended: {
    label: 'Defended Target (Pass Expected)',
    desc: 'Simulates a hardened model that strictly refuses canary disclosure and preserves security policy.',
  },
  vulnerable: {
    label: 'Vulnerable Target (Fail Expected)',
    desc: 'Simulates an adversarial leak: discloses secret canary / policy bypass token in model response.',
    isVuln: true,
  },
  ambiguous: {
    label: 'Ambiguous Target (Inconclusive)',
    desc: 'Simulates vague replies ("Okay.") lacking explicit policy refusal phrases.',
  },
  flaky: {
    label: 'Flaky Target (Inconsistent)',
    desc: 'Alternates between vulnerable and defended replies to demonstrate repeatability testing.',
  },
  oversized: {
    label: 'Oversized Output (Inconclusive/Clamped)',
    desc: 'Simulates runaway generation exceeding response character bounds.',
  },
  error: {
    label: 'Target Connection Failure (Error)',
    desc: 'Simulates network socket drop or model engine crash. Evaluates as ERROR (never pass).',
  },
  timeout: {
    label: 'Target Inference Timeout (Error)',
    desc: 'Simulates request timeout exceeding deadline. Evaluates as ERROR (never pass).',
  },
}

export const TestLauncher: React.FC<TestLauncherProps> = ({
  tests,
  activeMode,
  loadingTests,
  isRunning,
  connections = [],
  onOpenConnections,
  onRunTest,
}) => {
  const [selectedTestId, setSelectedTestId] = useState<string>(
    tests[0]?.test_id || 'canary-disclosure'
  )
  const [targetMode, setTargetMode] = useState<TargetMode>(activeMode || 'mock')
  const [mockBehavior, setMockBehavior] = useState<MockBehavior>('vulnerable')
  const [ollamaModel, setOllamaModel] = useState<string>('llama3.2:3b')
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [repeatCount, setRepeatCount] = useState<number>(3)
  const [repeatBaseTest, setRepeatBaseTest] = useState<string>('canary-disclosure')
  const [showDetails, setShowDetails] = useState<boolean>(false)

  const effectiveConnectionId =
    selectedConnectionId && connections.some((c) => c.connection_id === selectedConnectionId)
      ? selectedConnectionId
      : connections[0]?.connection_id || ''

  const currentTest = tests.find((t) => t.test_id === selectedTestId) || tests[0]
  const activeSavedConn = connections.find((c) => c.connection_id === effectiveConnectionId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentTest) return

    let targetPayload: any = {
      mode: targetMode,
    }

    if (targetMode === 'mock') {
      targetPayload.mock_behavior = mockBehavior
    } else if (targetMode === 'ollama') {
      targetPayload.model = ollamaModel.trim() || 'llama3.2:3b'
    } else if (targetMode === 'connection') {
      if (!activeSavedConn) {
        return
      }
      targetPayload = {
        mode: activeSavedConn.provider as TargetMode,
        connection_id: activeSavedConn.connection_id,
        provider: activeSavedConn.provider,
        model: activeSavedConn.model,
        base_url: activeSavedConn.base_url || undefined,
      }
    }

    const req: RunRequest = {
      test_id: currentTest.test_id,
      target: targetPayload,
    }

    if (currentTest.supports_repeat_options) {
      req.options = {
        repeat_count: repeatCount,
        repeat_base_test: repeatBaseTest,
      }
    }

    onRunTest(req)
  }

  // Capability awareness check
  const requiredCaps = currentTest?.required_capabilities || []
  let capabilityWarning: string | null = null
  if (targetMode === 'ollama') {
    const isVision = ollamaModel.toLowerCase().includes('vision') || ollamaModel.toLowerCase().includes('llava')
    if (requiredCaps.includes('vision') && !isVision) {
      capabilityWarning = `This test requires vision capability, which model '${ollamaModel}' does not declare. Evaluation will conclude as UNSUPPORTED.`
    }
  } else if (targetMode === 'connection' && activeSavedConn?.capabilities) {
    for (const cap of requiredCaps) {
      if (!(activeSavedConn.capabilities as any)[cap]) {
        capabilityWarning = `Connection '${activeSavedConn.name}' does not declare '${cap}' capability. Evaluation will conclude as UNSUPPORTED.`
        break
      }
    }
  }

  return (
    <div className="card test-launcher-card">
      <div className="card-header">
        <div className="card-header-title">
          <Sliders className="card-header-icon" />
          <h2>Security Test Control & Adversarial Launcher</h2>
        </div>
        <div className="launcher-header-right">
          {onOpenConnections && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={onOpenConnections}
            >
              <Server className="icon-xs" />
              Manage Model Connections ({connections.length})
            </button>
          )}
          <span className="text-xs text-muted ml-2">Synchronous Evaluation</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="launcher-form">
        <div className="launcher-grid">
          {/* Test Case Selection */}
          <div className="form-group">
            <label htmlFor="test-select" className="form-label">
              Registered Security Test
            </label>
            <select
              id="test-select"
              className="form-select"
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              disabled={loadingTests || isRunning}
            >
              {tests.map((t) => (
                <option key={t.test_id} value={t.test_id}>
                  {t.name} ({t.test_id} v{t.version})
                </option>
              ))}
            </select>
            <p className="form-hint">
              {currentTest?.description || 'Select registered benchmark'}
            </p>
          </div>

          {/* Target Engine Mode */}
          <div className="form-group">
            <label htmlFor="target-mode-select" className="form-label">
              Target Engine Mode
            </label>
            <select
              id="target-mode-select"
              className="form-select"
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as TargetMode)}
              disabled={isRunning}
            >
              <option value="mock">Deterministic Mock Simulator</option>
              <option value="ollama">Local Neural Model (Ollama: llama3.2:3b)</option>
              {connections.length > 0 && (
                <option value="connection">Saved Model Connection ({connections.length})</option>
              )}
            </select>
            <p className="form-hint">
              {targetMode === 'mock'
                ? 'Rapid deterministic simulation of attack profiles'
                : targetMode === 'ollama'
                ? 'Real local neural inference via Ollama POST /api/generate'
                : 'Select from configured cloud or self-hosted model endpoints'}
            </p>
          </div>

          {/* Target Profile or Model Configuration */}
          <div className="form-group">
            <label htmlFor="behavior-select" className="form-label">
              {targetMode === 'mock'
                ? 'Target Profile & Behavior'
                : targetMode === 'connection'
                ? 'Select Saved Connection'
                : 'Ollama Model Identifier'}
            </label>
            {targetMode === 'mock' ? (
              <select
                id="behavior-select"
                className="form-select"
                value={mockBehavior}
                onChange={(e) => setMockBehavior(e.target.value as MockBehavior)}
                disabled={isRunning}
              >
                {Object.entries(BEHAVIOR_DESCRIPTIONS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : targetMode === 'connection' ? (
              <select
                id="behavior-select"
                className="form-select"
                value={effectiveConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">-- Choose saved connection --</option>
                {connections.map((c) => (
                  <option key={c.connection_id} value={c.connection_id}>
                    {c.name} ({c.provider} · {c.model})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="behavior-select"
                type="text"
                className="form-input"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="Installed model (e.g. llama3.2:3b)"
                disabled={isRunning}
              />
            )}
            <p className="form-hint">
              {targetMode === 'mock'
                ? BEHAVIOR_DESCRIPTIONS[mockBehavior]?.desc
                : targetMode === 'connection'
                ? activeSavedConn
                  ? `Active: ${activeSavedConn.provider.toUpperCase()} (${activeSavedConn.model})`
                  : 'Select configured connection'
                : 'Configured local model name (llama3.2:3b pre-installed)'}
            </p>
          </div>

          {/* Repeatability Options (only for repeatability test) */}
          {currentTest?.supports_repeat_options && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Repeat Executions: <strong>{repeatCount}</strong>
                </label>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Number(e.target.value))}
                  className="form-range"
                  disabled={isRunning}
                />
                <p className="form-hint">2 to 10 sequential model inferences</p>
              </div>

              <div className="form-group">
                <label className="form-label">Base Test to Repeat</label>
                <select
                  className="form-select"
                  value={repeatBaseTest}
                  onChange={(e) => setRepeatBaseTest(e.target.value)}
                  disabled={isRunning}
                >
                  {tests
                    .filter((t) => !t.supports_repeat_options)
                    .map((t) => (
                      <option key={t.test_id} value={t.test_id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Capability Warning if model lacks test prerequisite */}
        {capabilityWarning && (
          <div className="alert-banner alert-warning mt-3">
            <AlertTriangle className="alert-icon" />
            <span>{capabilityWarning}</span>
          </div>
        )}

        {/* Selected Test Details Accordion */}
        {currentTest && (
          <div className="test-meta-banner">
            <div className="meta-banner-header" onClick={() => setShowDetails(!showDetails)}>
              <div className="meta-banner-summary">
                <Info className="meta-icon" />
                <span>
                  Expected: <strong>{currentTest.expected_behavior}</strong>
                </span>
              </div>
              <button
                type="button"
                className="btn-link text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDetails(!showDetails)
                }}
              >
                {showDetails ? 'Hide Details' : 'View Rule & Limitations'}
              </button>
            </div>

            {showDetails && (
              <div className="meta-details-content">
                <div className="meta-item">
                  <span className="meta-title">Rule ID:</span>
                  <code>{currentTest.rule_id} v{currentTest.rule_version}</code>
                </div>
                <div className="meta-item">
                  <span className="meta-title">Category:</span>
                  <span className="category-pill">{currentTest.category}</span>
                </div>
                {currentTest.required_capabilities && currentTest.required_capabilities.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-title">Required Capabilities:</span>
                    <span className="capabilities-pill">
                      {currentTest.required_capabilities.join(', ')}
                    </span>
                  </div>
                )}
                <div className="meta-item">
                  <span className="meta-title">Stated Limitations:</span>
                  <ul className="limitations-list">
                    {currentTest.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Button Row */}
        <div className="launcher-actions">
          <div className="launcher-hint">
            {targetMode === 'mock' && mockBehavior === 'vulnerable' ? (
              <span className="adversarial-notice">
                <AlertOctagon className="notice-icon" />
                Adversarial probe active: Target will disclose canary to test detector.
              </span>
            ) : targetMode === 'mock' && mockBehavior === 'defended' ? (
              <span className="defended-notice">
                <Shield className="notice-icon" />
                Safe baseline active: Target will enforce policy and refuse extraction.
              </span>
            ) : (
              <span className="text-muted text-xs">
                Independent execution: AI evaluated synchronously; sandbox verified separately.
              </span>
            )}
          </div>

          <button
            type="submit"
            className={`btn-primary ${isRunning ? 'btn-loading' : ''}`}
            disabled={isRunning || loadingTests || (targetMode === 'connection' && !effectiveConnectionId)}
            data-testid="run-test-button"
          >
            {isRunning ? (
              <>
                <span className="btn-spinner" />
                Evaluating Test...
              </>
            ) : (
              <>
                <Play className="btn-icon" />
                Launch Security Test
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
