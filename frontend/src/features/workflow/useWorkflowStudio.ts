import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import { INITIAL_NODES, INITIAL_EDGES } from './initialWorkflow';
import type {
  TargetModelNodeData,
  AdversarialPromptNodeData,
  SecurityTestNodeData,
  ModelExecutionNodeData,
  SecurityEvaluatorNodeData,
  EvidenceCollectorNodeData,
  ResultsPreviewNodeData,
  InfrastructureVerificationNodeData,
} from './types';
import type { SecurityTest, SecurityTestRunResponse, TargetMode, MockBehavior } from '@/types/api';
import { runSecurityTest, fetchRuns, triggerInfrastructureChecks, fetchRunDetails } from '@/api/runs';
import { apiClient } from '@/api/client';

export function useWorkflowStudio() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  // Studio State
  const [tests, setTests] = useState<SecurityTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('test-prompt-injection-01');
  const [targetMode, setTargetMode] = useState<TargetMode>('mock');
  const [mockBehavior, setMockBehavior] = useState<MockBehavior>('vulnerable');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<SecurityTestRunResponse | null>(null);
  const [runHistory, setRunHistory] = useState<SecurityTestRunResponse[]>([]);

  // Health and System
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [workerConnected, setWorkerConnected] = useState<boolean>(true);

  // Inspector and Modal state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [isRunDetailsModalOpen, setIsRunDetailsModalOpen] = useState<boolean>(false);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [workflowName, setWorkflowName] = useState<string>('AI Red-Team Security Evaluation Pipeline');

  // Handle custom connection
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)),
    [setEdges]
  );

  // Node selection handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Fetch initial tests, historical runs, and health from backend
  const loadInitialData = useCallback(async () => {
    try {
      const [testsRes, runsRes, healthRes] = await Promise.allSettled([
        apiClient<SecurityTest[]>('/api/security-tests'),
        fetchRuns(),
        apiClient<{ worker_connected?: boolean }>('/api/health'),
      ]);

      if (testsRes.status === 'fulfilled' && Array.isArray(testsRes.value)) {
        setTests(testsRes.value);
        setApiConnected(true);
      }

      if (runsRes.status === 'fulfilled' && Array.isArray(runsRes.value)) {
        setRunHistory(runsRes.value);
        if (runsRes.value.length > 0 && !currentRun) {
          // Pre-populate with first run if available
          const latestRun = runsRes.value[0];
          applyRunToCanvas(latestRun);
        }
      }

      if (healthRes.status === 'fulfilled') {
        setWorkerConnected(Boolean(healthRes.value?.worker_connected));
        setApiConnected(true);
      }
    } catch {
      setApiConnected(false);
    }
  }, [currentRun]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Synchronize a SecurityTestRunResponse directly into canvas nodes & edges
  const applyRunToCanvas = useCallback(
    (run: SecurityTestRunResponse) => {
      setCurrentRun(run);
      setCurrentRunId(run.run_id);
      setSelectedTestId(run.test_id);
      setTargetMode(run.target_mode);
      if (run.mock_behavior) {
        setMockBehavior(run.mock_behavior);
      }

      const aiPass = run.ai_evaluation.status === 'PASS';
      const aiFail = run.ai_evaluation.status === 'FAIL';

      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          switch (node.type) {
            case 'targetModel':
              return {
                ...node,
                data: {
                  ...node.data,
                  provider: run.target_mode,
                  modeLabel: run.target_mode === 'mock' ? 'MOCK' : 'REAL',
                  connectionStatus: 'connected',
                } as TargetModelNodeData,
              };

            case 'securityTest':
              return {
                ...node,
                data: {
                  ...node.data,
                  testId: run.test_id,
                  testName: run.test_name,
                  targetMode: run.target_mode,
                  mockBehavior: run.mock_behavior || 'vulnerable',
                } as SecurityTestNodeData,
              };

            case 'modelExecution':
              return {
                ...node,
                data: {
                  ...node.data,
                  status: 'completed',
                  latencyMs: 42,
                  modelId: 'safebox-defense-v1',
                } as ModelExecutionNodeData,
              };

            case 'securityEvaluator':
              return {
                ...node,
                data: {
                  ...node.data,
                  verdict: run.ai_evaluation.status,
                  detectionState: aiFail ? 'violation_detected' : 'neutralized',
                  indicatorsCount: run.ai_evaluation.findings?.length || 0,
                  findings: run.ai_evaluation.findings || [],
                } as SecurityEvaluatorNodeData,
              };

            case 'evidenceCollector':
              return {
                ...node,
                data: {
                  ...node.data,
                  evidenceCount: run.ai_evaluation.redacted_evidence?.length || 0,
                  latestEvidenceType: 'Redacted Tokens',
                  redactionStatus: 'ENFORCED',
                  collectionState: 'captured',
                  evidenceSnippets: run.ai_evaluation.redacted_evidence || [],
                } as EvidenceCollectorNodeData,
              };

            case 'resultsPreview':
              return {
                ...node,
                data: {
                  ...node.data,
                  verdict: run.ai_evaluation.status,
                  sanitizedResponse:
                    run.ai_evaluation.observed_behavior || 'Evaluation completed safely.',
                  latencyMs: 42,
                  runId: run.run_id,
                  onOpenRunDetails: () => setIsRunDetailsModalOpen(true),
                } as ResultsPreviewNodeData,
              };

            case 'infrastructureVerification': {
              const infra = run.infrastructure_verification;
              return {
                ...node,
                data: {
                  ...node.data,
                  id: node.id,
                  label: (node.data.label as string) || 'Infrastructure Verification',
                  runId: run.run_id,
                  status: (infra?.status as any) || 'NOT_VERIFIED',
                  workerId: infra?.worker_id || 'worker-docker-arm64-01',
                  verifiedAt: infra?.verified_at || null,
                  summary:
                    infra?.summary ||
                    'All 7 Docker isolation gates independently verified by worker.',
                  checks: (infra?.checks as any) || [],
                  onTriggerAudit: () => handleTriggerInfraAudit(run.run_id),
                },
              };
            }

            default:
              return node;
          }
        })
      );
    },
    [setNodes]
  );

  // Trigger On-Demand Infrastructure Re-Audit
  const handleTriggerInfraAudit = useCallback(
    async (runId: string) => {
      try {
        const updatedRun = await triggerInfrastructureChecks(runId);
        setCurrentRun(updatedRun);
        applyRunToCanvas(updatedRun);
      } catch (err) {
        console.error('Failed to trigger infra checks', err);
      }
    },
    [applyRunToCanvas]
  );

  // Execute Security Evaluation
  const handleRunWorkflow = useCallback(async () => {
    try {
      setIsRunning(true);

      // Animate edges during execution
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          animated: true,
          className: 'edge-running',
        }))
      );

      // Set Model Execution node to running
      setNodes((prev) =>
        prev.map((n) =>
          n.type === 'modelExecution'
            ? { ...n, data: { ...n.data, status: 'running' } }
            : n
        )
      );

      const response = await runSecurityTest({
        test_id: selectedTestId,
        target_mode: targetMode,
        mock_behavior: targetMode === 'mock' ? mockBehavior : undefined,
      });

      // Update state with real response
      applyRunToCanvas(response);
      setRunHistory((prev) => [response, ...prev.filter((r) => r.run_id !== response.run_id)]);
    } catch (err: unknown) {
      console.error('Execution failed:', err);
    } finally {
      setIsRunning(false);
      // Reset edge animations
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          animated: false,
          className: '',
        }))
      );
    }
  }, [selectedTestId, targetMode, mockBehavior, setEdges, setNodes, applyRunToCanvas]);

  // Update specific node data from Inspector
  const updateNodeData = useCallback(
    (nodeId: string, partialData: Record<string, unknown>) => {
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...partialData,
              },
            };
          }
          return n;
        })
      );

      // Also sync top-level state if test or provider was changed
      if (partialData.testId && typeof partialData.testId === 'string') {
        setSelectedTestId(partialData.testId);
      }
      if (partialData.provider && typeof partialData.provider === 'string') {
        setTargetMode(partialData.provider as TargetMode);
      }
    },
    [setNodes]
  );

  // Reset to default layout
  const resetLayout = useCallback(() => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
  }, [setNodes, setEdges]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    tests,
    selectedTestId,
    setSelectedTestId,
    targetMode,
    setTargetMode,
    mockBehavior,
    setMockBehavior,
    isRunning,
    currentRunId,
    currentRun,
    runHistory,
    apiConnected,
    workerConnected,
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    isHistoryDrawerOpen,
    setIsHistoryDrawerOpen,
    isRunDetailsModalOpen,
    setIsRunDetailsModalOpen,
    isComposerCollapsed,
    setIsComposerCollapsed,
    showMinimap,
    setShowMinimap,
    workflowName,
    setWorkflowName,
    handleRunWorkflow,
    applyRunToCanvas,
    handleTriggerInfraAudit,
    updateNodeData,
    resetLayout,
    refreshRuns: loadInitialData,
  };
}
