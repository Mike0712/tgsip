import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

export interface User {
  id: number;
  telegram_id: string;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

export type AuthErrorReason = 'token_expired' | 'token_invalid' | 'no_token' | null;

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authErrorReason: AuthErrorReason;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
    authErrorReason: null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setAuthState(prev => ({ ...prev, isLoading: false, authErrorReason: 'no_token' }));
        return;
      }

      try {
        const response = await apiClient.verifyToken();
        
        if (response.success && response.data) {
          setAuthState({
            user: response.data.user,
            token,
            isLoading: false,
            isAuthenticated: true,
            authErrorReason: null,
          });
        } else {
          // Проверяем, просрочен ли токен
          const isExpired = response.data?.expired === true;
          localStorage.removeItem('auth_token');
          setAuthState({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            authErrorReason: isExpired ? 'token_expired' : 'token_invalid',
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
          authErrorReason: 'token_invalid',
        });
      }
    };

    checkAuth();
  }, []);

  // Аутентификация через Telegram
  const loginWithTelegram = useCallback(async (initData: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await apiClient.authenticateWithTelegram(initData);
      
      if (response.success && response.data) {
        const { token, user } = response.data;
        
        if (token && user) {
          apiClient.setToken(token);
          setAuthState({
            user,
            token,
            isLoading: false,
            isAuthenticated: true,
            authErrorReason: null,
          });
          
          return { success: true, user };
        }
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: response.error };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        authErrorReason: null,
      });
    }
  }, []);

  return {
    ...authState,
    loginWithTelegram,
    logout,
  };
}
