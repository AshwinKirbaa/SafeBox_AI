import type {
  SecurityTest,
  SecurityTestRunResponse,
  AIEvaluationResult,
  InfrastructureVerificationResult,
  TargetMode,
  MockBehavior,
  SeverityLevel,
} from '@/types/api';

export type WorkflowNodeType =
  | 'targetModel'
  | 'adversarialPrompt'
  | 'securityTest'
  | 'modelExecution'
  | 'securityEvaluator'
  | 'evidenceCollector'
  | 'resultsPreview'
  | 'infrastructureVerification';

export interface BaseNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  isEvaluating?: boolean;
  onSelect?: () => void;
}

export interface TargetModelNodeData extends BaseNodeData {
  provider: 'mock' | 'container' | 'ollama' | 'openai' | 'anthropic';
  modelId: string;
  modeLabel: 'MOCK' | 'REAL';
  connectionStatus: 'connected' | 'offline' | 'checking';
  supportedProviders: string[];
}

export interface AdversarialPromptNodeData extends BaseNodeData {
  promptName: string;
  attackCategory: string;
  promptPreview: string;
  fullPrompt: string;
  multiTurn: boolean;
  onEditPrompt?: () => void;
}

export interface SecurityTestNodeData extends BaseNodeData {
  testId: string;
  testName: string;
  category: string;
  severity: SeverityLevel;
  version: string;
  expectedBehavior: string;
  targetMode: TargetMode;
  mockBehavior: MockBehavior;
}

export interface ModelExecutionNodeData extends BaseNodeData {
  provider: string;
  modelId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  latencyMs?: number | null;
  tokensProcessed?: number | null;
  errorMessage?: string | null;
}

export interface SecurityEvaluatorNodeData extends BaseNodeData {
  ruleName: string;
  ruleVersion: string;
  verdict: 'PASS' | 'FAIL' | 'ERROR' | 'AWAITING';
  detectionState: 'neutralized' | 'violation_detected' | 'evaluating' | 'untested';
  indicatorsCount: number;
  findings: string[];
}

export interface EvidenceCollectorNodeData extends BaseNodeData {
  evidenceCount: number;
  latestEvidenceType: string;
  redactionStatus: 'ENFORCED' | 'PARTIAL' | 'NONE';
  collectionState: 'ready' | 'collecting' | 'captured';
  evidenceSnippets: string[];
}

export interface ResultsPreviewNodeData extends BaseNodeData {
  verdict: 'PASS' | 'FAIL' | 'ERROR' | 'AWAITING';
  sanitizedResponse: string;
  provider: string;
  modelId: string;
  latencyMs?: number | null;
  tokenCount?: number | null;
  evidenceSummary: string;
  runId?: string | null;
  onOpenRunDetails?: () => void;
}

export interface InfrastructureVerificationNodeData extends BaseNodeData {
  runId?: string | null;
  status: 'PASS' | 'FAIL' | 'PENDING' | 'NOT_VERIFIED' | 'UNAVAILABLE';
  workerId?: string | null;
  verifiedAt?: string | null;
  summary: string;
  checks: Array<{
    id: string;
    label: string;
    status: 'PASS' | 'FAIL' | 'NOT_REPORTED' | 'PENDING';
    explanation: string;
    expected?: string | null;
    observed?: string | null;
    evidence?: string | null;
  }>;
  onTriggerAudit?: () => void;
}

export interface WorkflowStudioState {
  // Active execution state
  isRunning: boolean;
  currentRunId: string | null;
  currentRun: SecurityTestRunResponse | null;
  runHistory: SecurityTestRunResponse[];
  
  // Active test and target configuration
  selectedTestId: string;
  targetMode: TargetMode;
  mockBehavior: MockBehavior;
  provider: 'mock' | 'container' | 'ollama';
  modelId: string;
  
  // Custom adversarial prompt override
  promptName: string;
  attackCategory: string;
  adversarialPrompt: string;
  
  // UI state
  selectedNodeId: string | null;
  isHistoryDrawerOpen: boolean;
  isRunDetailsModalOpen: boolean;
  isComposerCollapsed: boolean;
  showMinimap: boolean;
  apiConnected: boolean;
  activeTestCatalog: SecurityTest[];
  
  // Execution queue status
  queueStatus: 'idle' | 'running' | 'completed' | 'error';
  lastRunError: string | null;
}
