// API configuration and utility functions

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`);
      }

      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Auth endpoints
  async register(username: string, password: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{
      token: string;
      userId: string;
      username: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  // User endpoints
  async searchUsers(query: string) {
    return this.request('/api/users/search?q=' + encodeURIComponent(query));
  }

  async getCallHistory() {
    return this.request('/api/users/call-history');
  }

  async clearCallHistory() {
    return this.request('/api/users/call-history', {
      method: 'DELETE',
    });
  }

  // Contact endpoints
  async getFavorites() {
    return this.request('/api/contacts/favorites');
  }

  async toggleFavorite(userId: string) {
    return this.request('/api/contacts/toggle-favorite', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async isFavorited(userId: string) {
    return this.request(`/api/contacts/is-favorited?userId=${userId}`);
  }
}

export const apiService = new ApiService();
