import { apiClient } from './client';
import type { SecurityTestRunRequest, SecurityTestRunResponse } from '@/types/api';

export async function runSecurityTest(
  req: SecurityTestRunRequest
): Promise<SecurityTestRunResponse> {
  return apiClient<SecurityTestRunResponse>('/api/security-tests/run', {
    method: 'POST',
    body: JSON.stringify(req),
    timeoutMs: 25000,
  });
}

export async function fetchRuns(): Promise<SecurityTestRunResponse[]> {
  return apiClient<SecurityTestRunResponse[]>('/api/security-tests/runs', {
    timeoutMs: 10000,
  });
}

export async function fetchRunDetails(runId: string): Promise<SecurityTestRunResponse> {
  const encodedId = encodeURIComponent(runId);
  return apiClient<SecurityTestRunResponse>(`/api/security-tests/runs/${encodedId}`, {
    timeoutMs: 10000,
  });
}

export async function triggerInfrastructureChecks(
  runId: string
): Promise<SecurityTestRunResponse> {
  const encodedId = encodeURIComponent(runId);
  return apiClient<SecurityTestRunResponse>(
    `/api/security-tests/runs/${encodedId}/infrastructure-checks`,
    {
      method: 'POST',
      timeoutMs: 20000,
    }
  );
}
