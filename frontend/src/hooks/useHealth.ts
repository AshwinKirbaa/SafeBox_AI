import { useState, useEffect, useCallback } from 'react';
import { fetchHealth } from '@/api/health';
import type { HealthResponse } from '@/types/api';

export function useHealth(intervalMs: number = 15000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = checking initially
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchHealth();
      setHealth(data);
      setIsConnected(true);
      setError(null);
      setLastChecked(new Date());
    } catch (err: unknown) {
      setIsConnected(false);
      setHealth(null);
      const msg = err instanceof Error ? err.message : 'Backend unreachable';
      setError(msg);
      setLastChecked(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    if (intervalMs <= 0) return;

    const timer = setInterval(() => {
      checkHealth();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [checkHealth, intervalMs]);

  return {
    health,
    isConnected,
    isLoading,
    error,
    lastChecked,
    refreshHealth: checkHealth,
  };
}
