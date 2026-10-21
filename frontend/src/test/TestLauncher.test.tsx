import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TestLauncher } from '../components/TestLauncher'
import type { SecurityTestMeta } from '../types/safebox'

describe('TestLauncher Component', () => {
  const mockTests: SecurityTestMeta[] = [
    {
      test_id: 'canary-disclosure',
      name: 'Canary-secret disclosure',
      description: 'A fictional canary is placed in the system prompt',
      version: '1.0.0',
      category: 'secret_disclosure',
      expected_behavior: 'The target refuses',
      rule_id: 'canary-exact-match',
      rule_version: '1.0.0',
      limitations: ['Exact match only'],
      supports_repeat_options: false,
    },
  ]

  it('renders test selector and allows submitting a vulnerable mock test', async () => {
    const mockOnRun = vi.fn().mockResolvedValue(undefined)

    render(
      <TestLauncher
        tests={mockTests}
        activeMode="mock"
        loadingTests={false}
        isRunning={false}
        onRunTest={mockOnRun}
      />
    )

    expect(screen.getByText('Security Test Control & Adversarial Launcher')).toBeInTheDocument()
    expect(screen.getByText(/Canary-secret disclosure/)).toBeInTheDocument()

    // Select vulnerable behavior
    const behaviorSelect = screen.getByLabelText(/Target Profile & Behavior/)
    fireEvent.change(behaviorSelect, { target: { value: 'vulnerable' } })

    // Submit form
    const launchBtn = screen.getByTestId('run-test-button')
    fireEvent.click(launchBtn)

    expect(mockOnRun).toHaveBeenCalledWith({
      test_id: 'canary-disclosure',
      target: {
        mode: 'mock',
        mock_behavior: 'vulnerable',
      },
    })
  })

  it('allows selecting Ollama mode and submitting with model llama3.2:3b', async () => {
    const mockOnRun = vi.fn().mockResolvedValue(undefined)

    render(
      <TestLauncher
        tests={mockTests}
        activeMode="mock"
        loadingTests={false}
        isRunning={false}
        onRunTest={mockOnRun}
      />
    )

    // Select Ollama mode
    const modeSelect = screen.getByLabelText(/Target Engine Mode/)
    fireEvent.change(modeSelect, { target: { value: 'ollama' } })

    // Submit form
    const launchBtn = screen.getByTestId('run-test-button')
    fireEvent.click(launchBtn)

    expect(mockOnRun).toHaveBeenCalledWith({
      test_id: 'canary-disclosure',
      target: {
        mode: 'ollama',
        model: 'llama3.2:3b',
      },
    })
  })
})
