import { useState, useEffect, useCallback } from 'react';
import { fetchRuns, fetchRunDetails } from '@/api/runs';
import type { SecurityTestRunResponse } from '@/types/api';

export function useRuns(autoRefreshIntervalMs: number = 0) {
  const [runs, setRuns] = useState<SecurityTestRunResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRuns();
      setRuns(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load run history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();

    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(loadRuns, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [loadRuns, autoRefreshIntervalMs]);

  return {
    runs,
    isLoading,
    error,
    refreshRuns: loadRuns,
  };
}

export function useRunDetail(runId?: string) {
  const [run, setRun] = useState<SecurityTestRunResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(runId));
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    if (!runId) {
      setRun(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRunDetails(runId);
      setRun(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to load details for run ${runId}`;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  return {
    run,
    isLoading,
    error,
    refreshRun: loadRun,
    setRun,
  };
}
