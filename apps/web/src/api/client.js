const API_BASE = '/api/v1';
class ApiClient {
    async request(path, options = {}) {
        const url = API_BASE + path;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (options.headers) {
            const h = options.headers;
            Object.assign(headers, h);
        }
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers,
        });
        if (!response.ok) {
            const error = (await response.json().catch(() => ({
                error: { message: 'Request failed', statusCode: response.status },
            })));
            const statusMsg = 'HTTP ' + String(response.status);
            throw new Error(error.error?.message ?? statusMsg);
        }
        return response.json();
    }
    get(path) {
        return this.request(path);
    }
    post(path, body) {
        return this.request(path, {
            method: 'POST',
            body: body !== undefined ? JSON.stringify(body) : null,
        });
    }
    put(path, body) {
        return this.request(path, {
            method: 'PUT',
            body: body !== undefined ? JSON.stringify(body) : null,
        });
    }
    delete(path) {
        return this.request(path, {
            method: 'DELETE',
        });
    }
}
export const apiClient = new ApiClient();
