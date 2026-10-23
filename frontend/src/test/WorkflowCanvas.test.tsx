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
    expect(screen.getAllByText('Target strictly adhered to policy').length).toBeGreaterThanOrEqual(1)

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

  it('generates SVG edge paths with start and end coordinates matching port centers', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Edge 1: Origin to Junction
    const edgeOriginJunction = screen.getByTestId('edge-origin-junction')
    expect(edgeOriginJunction).toBeInTheDocument()
    const d1 = edgeOriginJunction.getAttribute('d')
    expect(d1).toBeTruthy()
    // Origin at x:60 + w:300 = 360, y:250 + h:140/2 = 320. Junction at x:440, y:230 + h:160/2 = 310
    expect(d1).toMatch(/^M 360 320 C/)
    expect(d1).toMatch(/440 310$/)

    // Edge 2: Junction Output A to AI Evaluation Input
    const edgeJunctionAi = screen.getByTestId('edge-junction-ai')
    expect(edgeJunctionAi).toBeInTheDocument()
    const d2 = edgeJunctionAi.getAttribute('d')
    expect(d2).toBeTruthy()
    // Junction at x:440 + w:300 = 740, Port A at y: 230 + 160*0.35 = 286. AI Eval at x:820, y: 70 + 190/2 = 165
    expect(d2).toMatch(/^M 740 286 C/)
    expect(d2).toMatch(/820 165$/)

    // Edge 3: Junction Output B to Docker Isolation Input
    const edgeJunctionDocker = screen.getByTestId('edge-junction-docker')
    expect(edgeJunctionDocker).toBeInTheDocument()
    const d3 = edgeJunctionDocker.getAttribute('d')
    expect(d3).toBeTruthy()
    // Junction at x:440 + w:300 = 740, Port B at y: 230 + 160*0.70 = 342. Docker at x:820, y: 350 + 160/2 = 430
    expect(d3).toMatch(/^M 740 342 C/)
    expect(d3).toMatch(/820 430$/)

    // Edges 4..10: Docker Isolation to all 7 Probes - verify clean bus fan-out to x:1260
    const probeIds = [
      'docker-socket-absence',
      'non-root-execution',
      'dropped-capabilities',
      'resource-limits',
      'workspace-isolation',
      'host-filesystem-protection',
      'network-egress',
    ]

    probeIds.forEach((probeId) => {
      const edge = screen.getByTestId(`edge-docker-probe-${probeId}`)
      expect(edge).toBeInTheDocument()
      const d = edge.getAttribute('d')
      expect(d).toBeTruthy()
      // All 7 edges must originate from Docker node output port at (1180, 430)
      expect(d).toMatch(/^M 1180 430 C/)
      // And terminate at the probe's left input port at x:1260
      expect(d).toMatch(/1260 \d+$/)
    })
  })

  it('collapses and re-expands the Node Inspector panel', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Inspector is open initially
    expect(screen.getByLabelText('Node Inspector')).toBeInTheDocument()

    // Click collapse button
    const collapseBtn = screen.getByRole('button', { name: /Collapse inspector/i })
    fireEvent.click(collapseBtn)

    // Inspector is closed
    expect(screen.queryByLabelText('Node Inspector')).not.toBeInTheDocument()

    // Expand button is shown
    const expandBtn = screen.getByRole('button', { name: /Open node inspector/i })
    expect(expandBtn).toBeInTheDocument()

    // Re-expand inspector
    fireEvent.click(expandBtn)
    expect(screen.getByLabelText('Node Inspector')).toBeInTheDocument()
  })

  it('correctly displays MISSING probe statuses when infrastructure checks are omitted', () => {
    const unverifiedRun: RunRecord = {
      ...mockRun,
      infrastructure: {
        status: 'MISSING',
        checks: [],
      },
    }

    render(
      <WorkflowCanvas
        run={unverifiedRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    // Probes show MISSING status pills
    const socketProbe = screen.getByTestId('workflow-probe-docker-socket-absence')
    expect(socketProbe).toHaveClass('probe-status-missing')
    expect(socketProbe.querySelector('.probe-status-pill')).toHaveTextContent('MISSING')
  })

  it('Plane A node renders responsive two-column grid and full-width verdict banner', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    const aiNode = screen.getByTestId('workflow-node-ai')
    expect(aiNode).toBeInTheDocument()

    // Title and verdict badge
    expect(aiNode.querySelector('.node-title')).toHaveTextContent('Plane A: AI Behavioral Safety')
    expect(aiNode.querySelector('.node-verdict-pill')).toHaveTextContent('PASS')

    // Two-column grid contains Rule and Evidence
    expect(aiNode.querySelector('.node-two-col-grid')).toBeInTheDocument()
    expect(aiNode.querySelector('.node-col-label')).toHaveTextContent('Rule')

    // Full-width verdict explanation banner
    expect(aiNode.querySelector('.node-verdict-banner')).toBeInTheDocument()
    expect(aiNode.querySelector('.verdict-summary-title')).toHaveTextContent('Model Adhered to Stated Safety Policy')
  })

  it('Dual-Plane Junction node renders full-width description and compact plane tiles', () => {
    render(
      <WorkflowCanvas
        run={mockRun}
        loading={false}
        allRuns={mockAllRuns}
        onSelectRunId={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    const junctionNode = screen.getByTestId('workflow-node-junction')
    expect(junctionNode).toBeInTheDocument()

    expect(junctionNode.querySelector('.junction-description')).toHaveTextContent(
      'Decoupled architecture: Independent behavioral evaluation and sandbox isolation.'
    )
    expect(junctionNode.querySelector('.junction-badges')).toBeInTheDocument()
    expect(junctionNode.querySelector('.pill-cyan')).toHaveTextContent('PLANE A: AI POLICY')
    expect(junctionNode.querySelector('.pill-violet')).toHaveTextContent('PLANE B: DOCKER')
  })
})
