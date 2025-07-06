/**
 * API Client with JWT authentication support
 * Provides authenticated HTTP requests for backend API calls
 */

import { authService } from '@/src/services/authService';

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

interface ApiError {
  error: string;
  message?: string;
}

/**
 * Authenticated API client for making HTTP requests to the backend
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082';
  }

  /**
   * Get JWT token from localStorage
   */
  private getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Create authenticated headers with JWT token
   */
  private createAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make an authenticated HTTP request
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;
    
    const url = `${this.baseUrl}${endpoint}`;
    
    // Merge headers with authentication if required
    const headers = requireAuth 
      ? { ...this.createAuthHeaders(), ...fetchOptions.headers }
      : { 'Content-Type': 'application/json', ...fetchOptions.headers };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401 && requireAuth) {
        console.warn('API request received 401 - clearing authentication');
        await authService.clearAuthTokens();
        
        // Redirect to login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        throw new Error('Authentication failed - please login again');
      }

      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as unknown as T;
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = data as unknown as ApiError;
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`API request failed for ${endpoint}:`, error.message);
        throw error;
      } else {
        console.error(`API request failed for ${endpoint}:`, error);
        throw new Error('Unknown API error');
      }
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  // Root Admin API methods
  
  /**
   * Root Admin login
   */
  async rootAdminLogin(credentials: { username: string; password: string }): Promise<any> {
    return authService.loginRootAdminWithJWT(credentials);
  }

  /**
   * Create new tenant
   */
  async createTenant(data: { tenant_code: string; tenant_name: string; admin_username: string }): Promise<any> {
    return this.post('/api/tenants', data);
  }

  /**
   * Get all tenants
   */
  async getTenants(): Promise<any[]> {
    return this.get('/api/tenants');
  }

  /**
   * Get tenant by code
   */
  async getTenant(tenantCode: string): Promise<any> {
    return this.get(`/api/tenants/${tenantCode}`);
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantCode: string, 
    data: { tenant_name?: string; status?: string }
  ): Promise<any> {
    return this.put(`/api/tenants/${tenantCode}`, data);
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantCode: string): Promise<any> {
    return this.delete(`/api/tenants/${tenantCode}`);
  }

  /**
   * Create new root admin
   */
  async createRootAdmin(data: { 
    username: string; 
    email: string; 
    full_name: string; 
  }): Promise<any> {
    return this.post('/api/root-admins', data);
  }

  /**
   * Get all root admins
   */
  async getRootAdmins(): Promise<any[]> {
    return this.get('/api/root-admins');
  }

  /**
   * Get root admin by username
   */
  async getRootAdmin(username: string): Promise<any> {
    return this.get(`/api/root-admins/${username}`);
  }

  /**
   * Delete root admin
   */
  async deleteRootAdmin(username: string): Promise<any> {
    return this.delete(`/api/root-admins/${username}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;