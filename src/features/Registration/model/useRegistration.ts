import { useState, useCallback } from 'react';

interface InitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
}

interface UseRegistrationReturn {
  register: (first_name: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  isLoading: boolean;
}

export const useRegistration = (): UseRegistrationReturn => {
  const [isLoading, setIsLoading] = useState(false);

  const register = useCallback(async (first_name: string): Promise<{ success: boolean; token?: string; error?: string }> => {
    setIsLoading(true);
    try {
      let initData: InitData | undefined;
      
      // В production режиме используем Telegram Web App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        initData = window.Telegram.WebApp.initData;
      }
      
      // В dev режиме получаем данные из URL параметров или body
      if (process.env.NODE_ENV === 'development') {
        const searchParams = new URLSearchParams(window.location.search);
        const userParam = searchParams.get('user');
        if (userParam) {
          try {
            const decodedParam = decodeURIComponent(userParam);
            const userData = JSON.parse(decodedParam);
            initData = { user: userData };
          } catch (parseError) {
            console.error('❌ Failed to parse user param:', parseError);
            return { success: false, error: 'Failed to parse Telegram user data' };
          }
        }
      }

      if (!initData?.user) {
        return { success: false, error: 'No Telegram user data available' };
      }

      // Подготавливаем данные для запроса
      const body: any = { first_name };
      
      // В production передаем initData для проверки подписи
      if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        body.initData = window.Telegram.WebApp.initData;
      } else if (process.env.NODE_ENV === 'development') {
        // В dev режиме передаем user
        body.user = initData.user;
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        return { success: true, token: data.token };
      } else {
        return { success: false, error: data.error || `Status: ${res.status}` };
      }
    } catch (e) {
      console.error('❌ Registration error:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    register,
    isLoading,
  };
};

