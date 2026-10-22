import React, { useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';

// Custom Nodes
import { TargetModelNode } from './nodes/TargetModelNode';
import { AdversarialPromptNode } from './nodes/AdversarialPromptNode';
import { SecurityTestNode } from './nodes/SecurityTestNode';
import { ModelExecutionNode } from './nodes/ModelExecutionNode';
import { SecurityEvaluatorNode } from './nodes/SecurityEvaluatorNode';
import { EvidenceCollectorNode } from './nodes/EvidenceCollectorNode';
import { ResultsPreviewNode } from './nodes/ResultsPreviewNode';
import { InfrastructureVerificationNode } from './nodes/InfrastructureVerificationNode';

// Floating UI Components
import { TopToolbar } from './components/TopToolbar';
import { BottomComposer } from './components/BottomComposer';
import { RightUtilityToolbar } from './components/RightUtilityToolbar';
import { ContextualInspector } from './components/ContextualInspector';
import { RunHistoryDrawer } from './components/RunHistoryDrawer';
import { FullRunDetailsModal } from './components/FullRunDetailsModal';

// State Hook
import { useWorkflowStudio } from './useWorkflowStudio';

const WorkflowStudioInner: React.FC = () => {
  const {
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
    handleRunWorkflow,
    applyRunToCanvas,
    handleTriggerInfraAudit,
    updateNodeData,
    resetLayout,
    refreshRuns,
  } = useWorkflowStudio();

  const { fitView, setCenter } = useReactFlow();

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 });
  }, [fitView]);

  const handleCenterView = useCallback(() => {
    setCenter(780, 260, { zoom: 0.85, duration: 400 });
  }, [setCenter]);

  // Register the 8 node types
  const nodeTypes = useMemo(
    () => ({
      targetModel: TargetModelNode,
      adversarialPrompt: AdversarialPromptNode,
      securityTest: SecurityTestNode,
      modelExecution: ModelExecutionNode,
      securityEvaluator: SecurityEvaluatorNode,
      evidenceCollector: EvidenceCollectorNode,
      resultsPreview: ResultsPreviewNode,
      infrastructureVerification: InfrastructureVerificationNode,
    }),
    []
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090A0D]">
      {/* 1. Compact Top Toolbar */}
      <TopToolbar
        workflowName={workflowName}
        isRunning={isRunning}
        onRunWorkflow={handleRunWorkflow}
        apiConnected={apiConnected}
        workerConnected={workerConnected}
        currentRun={currentRun}
        runHistory={runHistory}
        onSelectRun={applyRunToCanvas}
        onOpenHistory={() => setIsHistoryDrawerOpen(true)}
        onResetLayout={() => {
          resetLayout();
          setTimeout(handleFitView, 100);
        }}
        onOpenHelp={() => setSelectedNodeId('node-security-test')}
        onOpenRunDetails={() => setIsRunDetailsModalOpen(true)}
      />

      {/* 2. Primary ReactFlow Fullscreen Dotted Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultViewport={{ x: 30, y: 30, zoom: 0.85 }}
        minZoom={0.2}
        maxZoom={2.0}
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        className="w-full h-full"
      >
        {/* Subtle Dotted Grid Background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#1e2430"
          className="bg-[#090A0D]"
        />

        {/* Optional Minimap */}
        {showMinimap && (
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'resultsPreview') return '#31d89a';
              if (n.type === 'adversarialPrompt') return '#ff526d';
              if (n.type === 'securityTest') return '#f5bd4f';
              if (n.type === 'infrastructureVerification') return '#638bff';
              return '#42d9ff';
            }}
            maskColor="rgba(9, 10, 13, 0.85)"
            className="!bottom-20 !right-4 !bg-[#111318] !border !border-[#30343e] !rounded-xl !overflow-hidden !shadow-2xl"
          />
        )}
      </ReactFlow>

      {/* 3. Small Floating Vertical Utility Toolbar on Right */}
      <RightUtilityToolbar
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        onFitView={handleFitView}
        onCenterView={handleCenterView}
      />

      {/* 4. Compact Floating Execution Composer near Bottom Center */}
      <BottomComposer
        tests={tests}
        selectedTestId={selectedTestId}
        onSelectTest={(testId) => {
          setSelectedTestId(testId);
          const t = tests.find((x) => x.id === testId);
          if (t) {
            updateNodeData('node-security-test', {
              testId: t.id,
              testName: t.name,
              category: t.category,
              severity: t.severity,
              expectedBehavior: t.description,
            });
          }
        }}
        targetMode={targetMode}
        onChangeTargetMode={(mode) => {
          setTargetMode(mode);
          updateNodeData('node-target-model', {
            provider: mode,
            modeLabel: mode === 'mock' ? 'MOCK' : 'REAL',
          });
        }}
        mockBehavior={mockBehavior}
        onChangeMockBehavior={(beh) => {
          setMockBehavior(beh);
          updateNodeData('node-security-test', { mockBehavior: beh });
        }}
        promptSummary={tests.find((t) => t.id === selectedTestId)?.name || 'Adversarial Injection'}
        isRunning={isRunning}
        onExecute={handleRunWorkflow}
        isCollapsed={isComposerCollapsed}
        onToggleCollapse={() => setIsComposerCollapsed(!isComposerCollapsed)}
      />

      {/* 5. Contextual Inspector Drawer (Slides out when a node is selected) */}
      <ContextualInspector
        selectedNode={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        tests={tests}
        onUpdateNodeData={updateNodeData}
        onOpenRunDetails={() => setIsRunDetailsModalOpen(true)}
        onTriggerInfraAudit={handleTriggerInfraAudit}
      />

      {/* 6. Run History Drawer */}
      <RunHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        runs={runHistory}
        currentRunId={currentRunId}
        onSelectRun={applyRunToCanvas}
      />

      {/* 7. Comprehensive Run Details Modal */}
      <FullRunDetailsModal
        run={currentRun}
        isOpen={isRunDetailsModalOpen}
        onClose={() => setIsRunDetailsModalOpen(false)}
        onChecksUpdated={refreshRuns}
      />
    </div>
  );
};

export const WorkflowStudio: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowStudioInner />
    </ReactFlowProvider>
  );
};

export default WorkflowStudio;
