import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RunHistory } from '../components/RunHistory'
import type { RunSummary } from '../types/safebox'

describe('RunHistory Component', () => {
  const mockRuns: RunSummary[] = [
    {
      run_id: 'run_ollama123456789012345678901234',
      state: 'COMPLETED',
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      status: 'PASS',
      target_mode: 'ollama',
      created_at: '2026-10-20T00:00:00Z',
      completed_at: '2026-10-20T00:00:05Z',
    },
    {
      run_id: 'run_mock1234567890123456789012345',
      state: 'COMPLETED',
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      status: 'FAIL',
      target_mode: 'mock',
      created_at: '2026-10-20T00:01:00Z',
      completed_at: '2026-10-20T00:01:01Z',
    },
  ]

  it('displays each historical run with its own recorded target', () => {
    render(
      <RunHistory
        runs={mockRuns}
        total={2}
        limit={10}
        offset={0}
        hasMore={false}
        selectedRunId={null}
        loading={false}
        onSelectRun={vi.fn()}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    // First run recorded as ollama
    const ollamaTarget = screen.getByTestId('history-target-run_ollama123456789012345678901234')
    expect(ollamaTarget).toHaveTextContent('OLLAMA · llama3.2:3b')

    // Second run recorded as mock
    const mockTarget = screen.getByTestId('history-target-run_mock1234567890123456789012345')
    expect(mockTarget).toHaveTextContent('MOCK SIMULATOR')
  })

  it('never labels a mock history item as a real model', () => {
    const mockWithModelName: RunSummary[] = [
      {
        run_id: 'run_mock_with_llama_model_id',
        state: 'COMPLETED',
        test_id: 'canary-disclosure',
        test_version: '1.0.0',
        status: 'PASS',
        target_mode: 'mock',
        model: 'llama3.2:3b',
        provider: 'mock',
        created_at: '2026-10-20T00:01:00Z',
        completed_at: '2026-10-20T00:01:01Z',
      },
    ]

    render(
      <RunHistory
        runs={mockWithModelName}
        total={1}
        limit={10}
        offset={0}
        hasMore={false}
        selectedRunId={null}
        loading={false}
        onSelectRun={vi.fn()}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const targetBadge = screen.getByTestId('history-target-run_mock_with_llama_model_id')
    expect(targetBadge).toHaveTextContent('MOCK SIMULATOR')
    expect(targetBadge).not.toHaveTextContent('OLLAMA')
  })

  it('calls onSelectRun when clicking Inspect button', () => {
    const handleSelectRun = vi.fn()
    render(
      <RunHistory
        runs={mockRuns}
        total={2}
        limit={10}
        offset={0}
        hasMore={false}
        selectedRunId={null}
        loading={false}
        onSelectRun={handleSelectRun}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect run/i })
    expect(inspectButtons.length).toBe(2)

    inspectButtons[0].click()
    expect(handleSelectRun).toHaveBeenCalledWith('run_ollama123456789012345678901234')
  })

  it('calls onSelectRun when clicking the table row', () => {
    const handleSelectRun = vi.fn()
    render(
      <RunHistory
        runs={mockRuns}
        total={2}
        limit={10}
        offset={0}
        hasMore={false}
        selectedRunId={null}
        loading={false}
        onSelectRun={handleSelectRun}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const row = screen.getByText('run_mock12345678...').closest('tr')
    expect(row).not.toBeNull()
    row?.click()
    expect(handleSelectRun).toHaveBeenCalledWith('run_mock1234567890123456789012345')
  })

  it('renders Viewing for selected run and triggers onSelectRun when clicked', () => {
    const handleSelectRun = vi.fn()
    render(
      <RunHistory
        runs={mockRuns}
        total={2}
        limit={10}
        offset={0}
        hasMore={false}
        selectedRunId="run_ollama123456789012345678901234"
        loading={false}
        onSelectRun={handleSelectRun}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const viewingBtn = screen.getByRole('button', { name: /Viewing run/i })
    expect(viewingBtn).toBeInTheDocument()
    expect(viewingBtn).toHaveClass('btn-viewing')
    expect(viewingBtn).toHaveTextContent('Viewing')

    viewingBtn.click()
    expect(handleSelectRun).toHaveBeenCalledWith('run_ollama123456789012345678901234')
  })
})
