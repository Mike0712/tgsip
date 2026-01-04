import { useState, useCallback } from 'react';
import { getTelegramInitData, getTelegramInitDataUnsafe } from '@/shared/lib/telegramUtils';

interface UseRegistrationReturn {
  register: (first_name: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  isLoading: boolean;
}

export const useRegistration = (): UseRegistrationReturn => {
  const [isLoading, setIsLoading] = useState(false);

  const register = useCallback(async (first_name: string): Promise<{ success: boolean; token?: string; error?: string }> => {
    setIsLoading(true);
    try {
      const initDataUnsafe = getTelegramInitDataUnsafe();

      if (!initDataUnsafe?.user) {
        return { success: false, error: 'No Telegram user data available' };
      }

      // Подготавливаем данные для запроса
      const body: any = { first_name };
      
      const initData = getTelegramInitData();
      if (initData && process.env.NODE_ENV === 'production') {
        // В production передаем initData для проверки подписи
        body.initData = initData;
      } else if (process.env.NODE_ENV === 'development') {
        // В dev режиме передаем user
        body.user = initDataUnsafe.user;
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

