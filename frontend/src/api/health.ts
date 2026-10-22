import { apiClient } from './client';
import type { HealthResponse } from '@/types/api';

export async function fetchHealth(): Promise<HealthResponse> {
  return apiClient<HealthResponse>('/api/health', { timeoutMs: 5000 });
}
