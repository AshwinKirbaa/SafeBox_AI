// SafeBox AI API Types

export type TargetMode = 'mock' | 'container';
export type MockBehavior = 'safe' | 'vulnerable';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RunOverallStatus = 'completed' | 'running' | 'failed';
export type AIEvaluationStatus = 'PASS' | 'FAIL' | 'ERROR';
export type InfrastructureCheckStatus = 'PASS' | 'FAIL' | 'NOT_REPORTED' | 'PENDING';
export type InfrastructureOverallStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNAVAILABLE';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  worker_connected: boolean;
  docker_available: boolean;
  details?: {
    platform?: string;
    active_runs_cached?: number;
    engine?: string;
    checks_supported?: number;
    [key: string]: unknown;
  };
}

export interface SecurityTest {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: SeverityLevel;
  supported_target_modes: TargetMode[];
  supported_mock_behaviors: MockBehavior[];
}

export interface SecurityTestRunRequest {
  test_id: string;
  target_mode: TargetMode;
  mock_behavior?: MockBehavior;
  config?: Record<string, unknown>;
}

export interface AIEvaluationResult {
  status: AIEvaluationStatus;
  expected_behavior: string;
  observed_behavior: string;
  findings: string[];
  redacted_evidence: string[];
  error_details?: string | null;
}

export interface InfrastructureCheckResult {
  id: string;
  label: string;
  status: InfrastructureCheckStatus;
  explanation: string;
  expected?: string | null;
  observed?: string | null;
  evidence?: string | null;
  limitations?: string | null;
}

export interface InfrastructureVerificationResult {
  status: InfrastructureOverallStatus;
  summary: string;
  checks: InfrastructureCheckResult[];
  worker_id?: string | null;
  verified_at?: string | null;
}

export interface SecurityTestRunResponse {
  run_id: string;
  test_id: string;
  test_name: string;
  target_mode: TargetMode;
  mock_behavior?: MockBehavior | null;
  status: RunOverallStatus;
  ai_evaluation: AIEvaluationResult;
  infrastructure_verification?: InfrastructureVerificationResult | null;
  created_at: string;
  completed_at?: string | null;
}
