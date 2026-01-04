import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { getTelegramInitDataUnsafe } from '@/shared/lib/telegramUtils';

interface UseRegistrationRequestReturn {
  submitRegistrationRequest: () => Promise<boolean>;
}

export const useRegistrationRequest = (
  showAlert: (title: string, description?: string, variant?: 'default' | 'success' | 'error' | 'warning') => void
): UseRegistrationRequestReturn => {
  const submitRegistrationRequest = useCallback(async (): Promise<boolean> => {
    try {
      const initDataUnsafe = getTelegramInitDataUnsafe();

      if (!initDataUnsafe?.user) {
        showAlert(
          'Нет данных Telegram',
          'Нет данных Telegram для подачи заявки',
          'error'
        );
        return false;
      }

      const u = initDataUnsafe.user;
      const payload = { telegram_id: String(u.id), username: u.username };
      
      const res = await fetch('/api/auth/request-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        return true; // Успех - открываем модальное окно регистрации
      } else {
        const data = await res.json().catch(() => ({}));
        showAlert(
          'Ошибка отправки заявки',
          data.error || `Статус: ${res.status}`,
          'error'
        );
        return false;
      }
    } catch (e) {
      console.error('❌ Registration request error:', e);
      showAlert(
        'Ошибка сети',
        e instanceof Error ? e.message : 'Unknown error',
        'error'
      );
      return false;
    }
  }, [showAlert]);

  return {
    submitRegistrationRequest,
  };
};

