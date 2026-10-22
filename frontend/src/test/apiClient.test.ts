import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiClientError, getApiBaseUrl, setApiBaseUrl } from '../api/client';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes base URL and removes trailing slashes', () => {
    setApiBaseUrl('http://127.0.0.1:8000///');
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:8000');
  });

  it('handles successful JSON responses', async () => {
    const mockData = { status: 'healthy', version: '1.0.0' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    } as Response);

    const result = await apiClient<typeof mockData>('/api/health');
    expect(result).toEqual(mockData);
  });

  it('throws ApiClientError with backend detail on HTTP 400/404/500 errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: "Test 'unknown-test' not found." }),
    } as Response);

    await expect(apiClient('/api/security-tests/unknown-test')).rejects.toThrow(
      "Test 'unknown-test' not found."
    );
  });

  it('distinguishes network dropouts from API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiClient('/api/health')).rejects.toThrow(ApiClientError);
    try {
      await apiClient('/api/health');
    } catch (err) {
      expect((err as ApiClientError).isNetworkError).toBe(true);
    }
  });
});
