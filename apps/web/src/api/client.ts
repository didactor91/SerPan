const API_BASE = '/api/v1';

interface ApiError {
  error?: {
    message?: string;
    statusCode?: number;
  };
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = API_BASE + path;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      const h = options.headers as Record<string, string>;
      Object.assign(headers, h);
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = (await response.json().catch(() => ({
        error: { message: 'Request failed', statusCode: response.status },
      }))) as ApiError;
      const statusMsg = 'HTTP ' + String(response.status);
      throw new Error(error.error?.message ?? statusMsg);
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
