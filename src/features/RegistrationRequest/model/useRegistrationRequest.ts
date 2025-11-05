import { useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface InitDataUnsafe {
  user?: {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
}

interface UseRegistrationRequestReturn {
  submitRegistrationRequest: () => Promise<void>;
}

export const useRegistrationRequest = (
  showAlert: (title: string, description?: string, variant?: 'default' | 'success' | 'error' | 'warning') => void
): UseRegistrationRequestReturn => {
  const submitRegistrationRequest = useCallback(async () => {
    try {
      let initDataUnsafe: InitDataUnsafe | undefined;
      
      // В production режиме используем Telegram Web App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe) {
        initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
      }
      
      // В dev режиме получаем данные из URL параметров
      if (process.env.NODE_ENV === 'development') {
        const searchParams = new URLSearchParams(window.location.search);
        const userParam = searchParams.get('user');
        if (userParam) {
          try {
            const decodedParam = decodeURIComponent(userParam);
            const userData = JSON.parse(decodedParam);
            initDataUnsafe = { user: userData };
          } catch (parseError) {
            console.error('❌ Failed to parse user param:', parseError);
            showAlert(
              'Ошибка парсинга данных',
              parseError instanceof Error ? parseError.message : 'Unknown error',
              'error'
            );
            return;
          }
        }
      }

      if (!initDataUnsafe?.user) {
        showAlert(
          'Нет данных Telegram',
          'Нет данных Telegram для подачи заявки',
          'error'
        );
        return;
      }

      const u = initDataUnsafe.user;
      const payload = { telegram_id: String(u.id), username: u.username };
      
      const res = await fetch('/api/auth/request-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showAlert(
          'Заявка отправлена',
          'Мы свяжемся с вами после одобрения.',
          'success'
        );
      } else {
        const data = await res.json().catch(() => ({}));
        showAlert(
          'Ошибка отправки заявки',
          data.error || `Статус: ${res.status}`,
          'error'
        );
      }
    } catch (e) {
      console.error('❌ Registration request error:', e);
      showAlert(
        'Ошибка сети',
        e instanceof Error ? e.message : 'Unknown error',
        'error'
      );
    }
  }, [showAlert]);

  return {
    submitRegistrationRequest,
  };
};

