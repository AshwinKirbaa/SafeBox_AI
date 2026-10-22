import { apiClient } from './client';
import type { SecurityTest } from '@/types/api';

export async function fetchSecurityTests(): Promise<SecurityTest[]> {
  return apiClient<SecurityTest[]>('/api/security-tests', { timeoutMs: 10000 });
}
