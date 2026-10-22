import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import './setup';
import React from 'react';
import { INITIAL_NODES, INITIAL_EDGES } from '../features/workflow/initialWorkflow';
import { TopToolbar } from '../features/workflow/components/TopToolbar';
import { BottomComposer } from '../features/workflow/components/BottomComposer';
import { InfrastructureVerificationNode } from '../features/workflow/nodes/InfrastructureVerificationNode';
import { ResultsPreviewNode } from '../features/workflow/nodes/ResultsPreviewNode';
import { TargetModelNode } from '../features/workflow/nodes/TargetModelNode';
import { ReactFlowProvider } from '@xyflow/react';

describe('SafeBox AI Visual Workflow Studio Architecture', () => {
  it('defines all 8 canonical workflow node types in the initial graph', () => {
    expect(INITIAL_NODES).toHaveLength(8);

    const nodeTypes = INITIAL_NODES.map((n) => n.type);
    expect(nodeTypes).toContain('targetModel');
    expect(nodeTypes).toContain('adversarialPrompt');
    expect(nodeTypes).toContain('securityTest');
    expect(nodeTypes).toContain('modelExecution');
    expect(nodeTypes).toContain('securityEvaluator');
    expect(nodeTypes).toContain('evidenceCollector');
    expect(nodeTypes).toContain('resultsPreview');
    expect(nodeTypes).toContain('infrastructureVerification');

    // Verify curved smoothstep edges connect the pipeline
    expect(INITIAL_EDGES.length).toBeGreaterThanOrEqual(7);
    INITIAL_EDGES.forEach((edge) => {
      expect(edge.type).toBe('smoothstep');
    });
  });

  it('renders TopToolbar with SafeBox AI branding and Run Workflow action', () => {
    render(
      <TopToolbar
        workflowName="AI Red-Team Security Evaluation Pipeline"
        isRunning={false}
        onRunWorkflow={vi.fn()}
        apiConnected={true}
        workerConnected={true}
        currentRun={null}
        runHistory={[]}
        onSelectRun={vi.fn()}
        onOpenHistory={vi.fn()}
        onResetLayout={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenRunDetails={vi.fn()}
      />
    );

    expect(screen.getByText(/SafeBox/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Red-Team Security Evaluation Pipeline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Workflow/i })).toBeInTheDocument();
    expect(screen.getByText(/API Online/i)).toBeInTheDocument();
  });

  it('renders BottomComposer with target modes and execute trigger', () => {
    const mockTests = [
      {
        id: 'test-prompt-injection-01',
        name: 'System Prompt Extraction & Override',
        description: 'Multi-turn adversarial injection test',
        category: 'Adversarial Robustness',
        severity: 'critical' as const,
        supported_target_modes: ['mock' as const, 'container' as const],
        supported_mock_behaviors: ['safe' as const, 'vulnerable' as const],
      },
    ];

    render(
      <BottomComposer
        tests={mockTests}
        selectedTestId="test-prompt-injection-01"
        onSelectTest={vi.fn()}
        targetMode="mock"
        onChangeTargetMode={vi.fn()}
        mockBehavior="vulnerable"
        onChangeMockBehavior={vi.fn()}
        promptSummary="System Prompt Extraction & Override"
        isRunning={false}
        onExecute={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
      />
    );

    expect(screen.getByText(/Execution Composer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute Evaluation/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Mock Target/i)).toBeInTheDocument();
  });

  it('renders all 7 Docker containment gates in InfrastructureVerificationNode without fabricating PASS', () => {
    const infraData = {
      id: 'node-infra',
      label: 'Infrastructure Verification',
      status: 'NOT_VERIFIED' as const,
      workerId: 'worker-docker-arm64-01',
      summary: 'Awaiting evaluation launch',
      checks: [
        { id: 'docker-socket-absence', label: 'Docker Socket Absence', status: 'NOT_REPORTED' as const, explanation: 'Test 1' },
        { id: 'non-root-execution', label: 'Non-Root User Execution', status: 'NOT_REPORTED' as const, explanation: 'Test 2' },
        { id: 'dropped-capabilities', label: 'Dropped Linux Capabilities', status: 'NOT_REPORTED' as const, explanation: 'Test 3' },
        { id: 'resource-limits', label: 'Resource Limits Enforcement', status: 'NOT_REPORTED' as const, explanation: 'Test 4' },
        { id: 'workspace-isolation', label: 'Workspace Isolation', status: 'NOT_REPORTED' as const, explanation: 'Test 5' },
        { id: 'host-filesystem-protection', label: 'Host Filesystem Protection', status: 'NOT_REPORTED' as const, explanation: 'Test 6' },
        { id: 'network-egress', label: 'Restricted Network Egress', status: 'NOT_REPORTED' as const, explanation: 'Test 7' },
      ],
    };

    render(
      <ReactFlowProvider>
        <InfrastructureVerificationNode
          {...({
            id: 'node-infra',
            data: infraData as any,
            selected: false,
            type: 'infrastructureVerification',
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            dragging: false,
          } as any)}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Infrastructure Verification/i)).toBeInTheDocument();
    // Missing checks must display NOT VERIFIED, never PASS
    expect(screen.getAllByText(/NOT VERIFIED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Docker Socket Absence/i)).toBeInTheDocument();
    expect(screen.getByText(/Network Egress/i)).toBeInTheDocument();
  });
});
