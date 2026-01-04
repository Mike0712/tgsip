'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/shared/hooks/useAuth';
import { useAlert } from '@/shared/hooks/useAlert';
import { AlertProvider } from '@/shared/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import { getTelegramInitData } from '@/shared/lib/telegramUtils';

const LoginPageContent = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, loginWithTelegram } = useAuth();
  const { showAlert } = useAlert();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/miniphone');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleTelegramLogin = async () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const initData = getTelegramInitData();

      if (initData) {
        setIsLoggingIn(true);
        try {
          const result = await loginWithTelegram(initData);
          if (result.success) {
            router.replace('/miniphone');
          } else {
            showAlert('Ошибка входа', result.error || 'Не удалось войти', 'error');
          }
        } catch (error) {
          showAlert('Ошибка входа', error instanceof Error ? error.message : 'Неизвестная ошибка', 'error');
        } finally {
          setIsLoggingIn(false);
        }
      } else {
        showAlert('Ошибка', 'Данные Telegram недоступны', 'error');
      }
    } else {
      showAlert('Ошибка', 'Telegram Web App недоступен', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Вход в MiniPhone</h1>
        <button
          onClick={handleTelegramLogin}
          disabled={isLoggingIn}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-base font-medium shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? 'Вход...' : 'Войти'}
        </button>
      </div>
    </div>
  );
};

const LoginPage = () => {
  return (
    <AlertProvider>
      <LoginPageContent />
      <AlertContainer />
    </AlertProvider>
  );
};

export default LoginPage;

