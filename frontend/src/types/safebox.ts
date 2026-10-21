export type TargetMode =
  | 'mock'
  | 'ollama'
  | 'openai_compatible'
  | 'generic_http'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'huggingface'
  | 'vllm'
  | 'llamacpp'
  | 'transformers'
  | 'custom'
  | string

export type MockBehavior =
  | 'defended'
  | 'vulnerable'
  | 'ambiguous'
  | 'flaky'
  | 'oversized'
  | 'error'
  | 'timeout'

export type AiTestStatus = 'PASS' | 'FAIL' | 'ERROR' | 'INCONCLUSIVE' | 'UNSUPPORTED'

export type InfraStatus =
  | 'PASS'
  | 'FAIL'
  | 'ERROR'
  | 'PENDING'
  | 'UNAVAILABLE'
  | 'MISSING'

export interface ModelCapabilities {
  text: boolean
  vision: boolean
  audio: boolean
  structured_output: boolean
  tool_calling: boolean
}

export interface ProviderMeta {
  id: string
  name: string
  tier: string
  description: string
  requires_api_key: boolean
  requires_base_url: boolean
  default_base_url?: string | null
  default_model?: string | null
  is_remote: boolean
  capabilities: ModelCapabilities
}

export interface SavedConnection {
  connection_id: string
  name: string
  provider: string
  model: string
  base_url?: string | null
  has_api_key: boolean
  masked_api_key?: string | null
  custom_headers?: Record<string, string> | null
  request_template?: Record<string, any> | null
  response_path?: string | null
  capabilities?: ModelCapabilities | null
  is_remote?: boolean
  created_at: string
  updated_at: string
}

export interface ConnectionCreatePayload {
  name: string
  provider: string
  model: string
  base_url?: string | null
  api_key?: string | null
  custom_headers?: Record<string, string> | null
  request_template?: Record<string, any> | null
  response_path?: string | null
}

export interface ConnectionUpdatePayload {
  name?: string
  provider?: string
  model?: string
  base_url?: string | null
  api_key?: string | null
  custom_headers?: Record<string, string> | null
  request_template?: Record<string, any> | null
  response_path?: string | null
}

export interface ConnectionTestRequest {
  provider: string
  model?: string
  base_url?: string
  api_key?: string
  connection_id?: string
}

export interface ConnectionTestResponse {
  reachable: boolean
  model_available?: boolean | null
  latency_ms?: number | null
  capabilities?: ModelCapabilities | null
  discovered_models: string[]
  error_message?: string | null
}

export interface OllamaStatus {
  reachable: boolean
  configured_model: string
  model_available: boolean | null
}

export interface HealthResponse {
  status: string
  app_name: string
  environment: string
  version: string
  target_mode: TargetMode
  database_ok: boolean
  ollama: OllamaStatus | null
  supported_providers?: string[]
  time: string
}

export interface SecurityTestMeta {
  test_id: string
  name: string
  description: string
  version: string
  category: string
  expected_behavior: string
  rule_id: string
  rule_version: string
  limitations: string[]
  supports_repeat_options: boolean
  required_capabilities?: string[]
}

export interface SecurityTestListResponse {
  items: SecurityTestMeta[]
}

export interface TargetConfig {
  mode?: TargetMode
  provider?: string
  connection_id?: string
  mock_behavior?: MockBehavior
  model?: string
  base_url?: string
  api_key?: string
  custom_headers?: Record<string, string>
  request_template?: Record<string, any>
  response_path?: string
  temperature?: number
  timeout_seconds?: number
}

export interface RunOptions {
  repeat_count?: number
  repeat_base_test?: string
}

export interface RunRequest {
  test_id: string
  target: TargetConfig
  options?: RunOptions
}

export interface RunSummary {
  run_id: string
  state: 'RUNNING' | 'COMPLETED' | 'ABORTED'
  test_id: string
  test_version: string
  status: AiTestStatus | null
  target_mode: string
  provider?: string
  model?: string
  created_at: string
  completed_at: string | null
}

export interface RunListResponse {
  items: RunSummary[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface EvidenceItem {
  evidence_id: string
  run_id: string
  test_id: string
  kind: 'test_definition' | 'model_output' | 'target_error' | 'rule_result'
  content: string
  redacted: boolean
  truncated: boolean
  size_chars: number
  execution_index: number | null
  observed_status: string | null
  rule_id: string | null
  rule_version: string | null
  recorded_at: string
}

export interface RepeatExecutionSummary {
  index: number
  status: AiTestStatus
}

export interface RepeatabilitySummary {
  base_test_id: string
  executions: number
  agree: boolean
  agreement_rate: number
  outcomes: RepeatExecutionSummary[]
}

export interface EvidenceRef {
  evidence_id: string
  kind: string
}

export interface TokenUsageSummary {
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
}

export interface EvaluationResult {
  test_id: string
  test_version: string
  rule_id: string
  rule_version: string
  status: AiTestStatus
  explanation: string
  evidence_refs: EvidenceRef[]
  started_at: string
  completed_at: string
  matched_indicators: string[]
  limitations: string[]
  repeatability: RepeatabilitySummary | null
  token_usage?: TokenUsageSummary | null
  observed_latency_ms?: number | null
}

export interface InfraCheckResult {
  worker_id: string
  run_id: string
  check_id: string
  policy_id: string
  policy_version: string
  reported_state: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE'
  observed: string | null
  expected: string | null
  evidence_ref: string | null
  timestamp: string
  error: string | null
  limitation: string | null
  status: 'PASS' | 'FAIL' | 'ERROR' | 'PENDING' | 'UNAVAILABLE'
  received_at: string
  result_type: 'infrastructure_isolation'
}

export interface InfrastructureSummary {
  result_type: 'infrastructure_isolation'
  status: InfraStatus
  checks: InfraCheckResult[]
  note: string
}

export interface TargetInfo {
  mode: TargetMode
  adapter: string
  model: string
  provider?: string
  mock_behavior?: MockBehavior
  connection_id?: string
  is_remote?: boolean
  capabilities?: ModelCapabilities
}

export interface RunRecord {
  result_type: 'ai_behavior_test'
  run_id: string
  state: 'RUNNING' | 'COMPLETED' | 'ABORTED'
  test_id: string
  test_version: string
  target: TargetInfo
  created_at: string
  completed_at: string | null
  result: EvaluationResult | null
  evidence: EvidenceItem[]
  infrastructure: InfrastructureSummary
}

export interface ApiErrorDetail {
  loc: string[]
  msg: string
  type: string
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: ApiErrorDetail[]
  }
}
