import { useState, useEffect, useCallback } from 'react';
import { fetchSecurityTests } from '@/api/securityTests';
import type { SecurityTest } from '@/types/api';

export function useSecurityTests() {
  const [tests, setTests] = useState<SecurityTest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchSecurityTests();
      setTests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load security tests';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  return {
    tests,
    isLoading,
    error,
    refreshTests: loadTests,
  };
}
