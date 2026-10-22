import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import type { RunRecord, RunSummary } from '../types/safebox'

describe('WorkflowCanvas Component', () => {
  const mockRun: RunRecord = {
    result_type: 'ai_behavior_test',
    run_id: 'run_canvas_test_12345678901234',
    state: 'COMPLETED',
    test_id: 'canary-disclosure',
    test_version: '1.0.0',
    target: {
      mode: 'ollama',
      adapter: 'ollama',
      model: 'llama3.2:3b',
      provider: 'ollama',
    },
    created_at: '2026-10-21T00:01:00Z',
    completed_at: '2026-10-21T00:01:05Z',
    result: {
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      rule_id: 'canary-exact-match',
      rule_version: '1.0.0',
      status: 'PASS',
      explanation: 'Target strictly adhered to policy',
      evidence_refs: ['ev-01'],
      started_at: '2026-10-21T00:01:00Z',
      completed_at: '2026-10-21T00:01:05Z',
      matched_indicators: [],
      limitations: [],
      repeatability: null,
    },
    evidence: [],
    infrastructure: {
      status: 'PASS',
      checks: [
        {
          check_id: 'docker-socket-absence',
          name: 'Docker Socket Absence',
          policy_id: 'no-docker-socket',
          status: 'PASS',
          observed: 'No socket found in container',
          expected: 'Socket must be unmounted',
        },
        {
          check_id: 'non-root-execution',
          name: 'Non-Root Execution',
          policy_id: 'non-root-user',
          status: 'PASS',
          observed: 'uid=10001 gid=10001',
          expected: 'Unprivileged UID/GID',
        },
        {
          check_id: 'dropped-capabilities',
          name: 'Dropped Linux Caps',
          policy_id: 'cap-drop-all',
          status: 'PASS',
          observed: 'CapEff=0x0',
          expected: 'CapEff=0x0',
        },
        {
          check_id: 'resource-limits',
          name: 'Cgroup Constraints',
          policy_id: 'bounded-cgroup-resources',
          status: 'PASS',
          observed: 'memory.max=268435456',
          expected: 'Bounded memory and PIDs',
        },
        {
          check_id: 'workspace-isolation',
          name: 'Workspace Isolation',
          policy_id: 'per-run-workspace-separation',
          status: 'PASS',
          observed: 'Only ephemeral run volume accessible',
          expected: 'Strict isolation',
        },
        {
          check_id: 'host-filesystem-protection',
          name: 'Host FS Protection',
          policy_id: 'no-prohibited-host-mounts',
          status: 'PASS',
          observed: 'Read-only root, no host leaks',
          expected: 'No sensitive host mounts',
        },
        {
          check_id: 'network-egress',
          name: 'Network Egress Block',
          policy_id: 'egress-deny-all',
          status: 'PASS',
          observed: 'Network unreachable (--network=none)',
          expected: 'Complete egress isolation',
        },
      ],
      note: 'Verified in hardened Docker sandbox',
    },
  }

  const mockAllRuns: RunSummary[] = [
    {
      run_id: mockRun.run_id,
      state: 'COMPLETED',
      test_id: 'canary-disclosure',
      test_version: '1.0.0',
      status: 'PASS',
      target_mode: 'ollama',
      model: 'llama3.2:3b',
      provider: 'ollama',
      created_at: '2026-10-21T00:01:00Z',
      completed_at: '2026-10-21T00:01:05Z',
    },
  ]

  it('renders all 4 primary pipeline nodes and all 7 probe nodes', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Primary nodes
    expect(screen.getByTestId('workflow-node-origin')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-node-junction')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-node-ai')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-node-docker')).toBeInTheDocument()

    // 7 probe nodes
    expect(screen.getByTestId('workflow-probe-docker-socket-absence')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-non-root-execution')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-dropped-capabilities')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-resource-limits')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-workspace-isolation')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-host-filesystem-protection')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-probe-network-egress')).toBeInTheDocument()
  })

  it('clicking a node selects it and updates the Node Inspector panel', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Click AI evaluation node
    fireEvent.click(screen.getByTestId('workflow-node-ai'))

    // Inspector updates to show Member 1 Evaluator details
    expect(screen.getByText('MEMBER 1 EVALUATOR')).toBeInTheDocument()
    expect(screen.getAllByText('canary-exact-match').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Target strictly adhered to policy')).toBeInTheDocument()

    // Click Socket probe node
    fireEvent.click(screen.getByTestId('workflow-probe-docker-socket-absence'))

    // Inspector updates to show probe details
    expect(screen.getByText('ISOLATION PROBE')).toBeInTheDocument()
    expect(screen.getAllByText('No socket found in container').length).toBeGreaterThanOrEqual(1)
  })

  it('allows zooming in and out via toolbar controls', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    const zoomIndicator = screen.getByText('90%')
    expect(zoomIndicator).toBeInTheDocument()

    // Click Zoom In
    const zoomInBtn = screen.getByRole('button', { name: /Zoom in/i })
    fireEvent.click(zoomInBtn)

    // Zoom level increments
    expect(screen.getByText('105%')).toBeInTheDocument()
  })
})
