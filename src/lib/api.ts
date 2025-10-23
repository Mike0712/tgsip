interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    telegram_id: string;
    username?: string;
    first_name: string;
    last_name?: string;
    photo_url?: string;
  };
  error?: string;
}

interface SipAccount {
  id: number;
  sip_username: string;
  sip_server: string;
  sip_ip: string;
  sip_port: number;
  secret: string;
  is_active: boolean;
  settings?: any;
}

interface Server {
  id: number;
  url: string;
  ip: string;
  port: string;
  created_at: string;
  updated_at: string;
}

interface Phone {
  id: number;
  server_id: number;
  number: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  server_url?: string;
  server_ip?: string;
  server_port?: string;
}

interface UserSipConfig {
  id: number;
  user_id: number;
  server_id: number;
  selected_phone_id: number | null;
  secret: string;
  server_url?: string;
  server_ip?: string;
  server_port?: string;
  phone_number?: string;
}

interface UserPhone {
  id: number;
  phone_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  // Данные из связанной таблицы phones
  phone_number?: string;
  server_id?: number;
  active?: boolean;
  server_url?: string;
  server_ip?: string;
  server_port?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  removeToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Merge additional headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Аутентификация через Telegram
  async authenticateWithTelegram(initData: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  }

  // Проверка токена
  async verifyToken(): Promise<ApiResponse<any>> {
    return this.request('/auth/verify');
  }

  // Выход из системы
  async logout(): Promise<ApiResponse<any>> {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    if (result.success) {
      this.removeToken();
    }
    
    return result;
  }

  // Получить SIP аккаунты
  async getSipAccounts(): Promise<ApiResponse<SipAccount[]>> {
    return this.request<SipAccount[]>('/sip/accounts');
  }

  // Создать SIP аккаунт
  async createSipAccount(account: Partial<SipAccount>): Promise<ApiResponse<SipAccount>> {
    return this.request<SipAccount>('/sip/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }

  // Server endpoints
  async getServers(): Promise<ApiResponse<Server[]>> {
    return this.request<Server[]>('/servers');
  }

  async createServer(data: { url: string; ip: string; port: string }): Promise<ApiResponse<Server>> {
    return this.request<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServer(id: number, data: Partial<Server>): Promise<ApiResponse<Server>> {
    return this.request<Server>('/servers', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteServer(id: number): Promise<ApiResponse<void>> {
    return this.request<void>('/servers', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // Phone endpoints
  async getPhones(serverId?: number): Promise<ApiResponse<Phone[]>> {
    const query = serverId ? `?server_id=${serverId}` : '';
    return this.request<Phone[]>(`/phones${query}`);
  }

  async createPhone(data: { server_id: number; number: string; active?: boolean }): Promise<ApiResponse<Phone>> {
    return this.request<Phone>('/phones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePhone(id: number, data: Partial<Phone>): Promise<ApiResponse<Phone>> {
    return this.request<Phone>('/phones', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deletePhone(id: number): Promise<ApiResponse<void>> {
    return this.request<void>('/phones', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // User SIP endpoints
  async getUserSipConfigs(): Promise<ApiResponse<UserSipConfig[]>> {
    return this.request<UserSipConfig[]>('/user-sip');
  }

  async createUserSipConfig(data: { server_id: number; selected_phone_id?: number; secret: string }): Promise<ApiResponse<UserSipConfig>> {
    return this.request<UserSipConfig>('/user-sip', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUserSipConfig(id: number, data: Partial<UserSipConfig>): Promise<ApiResponse<UserSipConfig>> {
    return this.request<UserSipConfig>('/user-sip', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteUserSipConfig(id: number): Promise<ApiResponse<void>> {
    return this.request<void>('/user-sip', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // User phones endpoints
  async getUserPhones(): Promise<ApiResponse<{ phones: UserPhone[]; count: number }>> {
    return this.request<{ phones: UserPhone[]; count: number }>('/user-phones');
  }
}

export const apiClient = new ApiClient();
export default ApiClient;

// Export types
export type { Server, Phone, UserSipConfig, SipAccount, AuthResponse, ApiResponse, UserPhone };
