// SafeBox AI API Client

export class ApiClientError extends Error {
  status?: number;
  data?: unknown;
  isNetworkError: boolean;

  constructor(message: string, status?: number, data?: unknown, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

// Configurable API base URL, supports dynamic override via localStorage or environment
export function getApiBaseUrl(): string {
  const localOverride = typeof window !== 'undefined' ? localStorage.getItem('safebox_api_base_url') : null;
  if (localOverride && localOverride.trim()) {
    return localOverride.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined);
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // When in browser, use relative base so Vite dev proxy forwards /api to backend seamlessly across tunnels & LAN
  if (typeof window !== 'undefined' && window.location?.origin) {
    return '';
  }
  return 'http://127.0.0.1:8000';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('safebox_api_base_url', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('safebox_api_base_url');
    }
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (fetchOptions.body && typeof fetchOptions.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response body safely
    let responseData: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      try {
        responseData = await response.text();
      } catch {
        responseData = null;
      }
    }

    if (!response.ok) {
      const errorMsg =
        (typeof responseData === 'object' && responseData && 'detail' in responseData)
          ? String((responseData as { detail: unknown }).detail)
          : `API Request failed with status ${response.status}: ${response.statusText}`;
      
      throw new ApiClientError(errorMsg, response.status, responseData, false);
    }

    return responseData as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof ApiClientError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError(`Request timeout after ${timeoutMs}ms to ${fullUrl}`, undefined, null, true);
    }

    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new ApiClientError(`Cannot connect to SafeBox AI service at ${baseUrl}. ${message}`, undefined, null, true);
  }
}
