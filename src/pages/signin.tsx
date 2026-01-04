'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/shared/hooks/useAuth';
import { useAlert } from '@/shared/hooks/useAlert';
import { AlertProvider } from '@/shared/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import FriendlyRetryScreen from '@/features/AuthError/ui/FriendlyRetryScreen';
import { apiClient } from '@/lib/api';
import { getTelegramInitData } from '@/shared/lib/telegramUtils';

const SignInPage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string>('Access denied');

  useEffect(() => {
    // Если пользователь уже аутентифицирован, редиректим на miniphone
    if (!isLoading && isAuthenticated && user) {
      router.replace('/miniphone');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    // Пытаемся аутентифицироваться через Telegram при загрузке страницы
    if (!isLoading && !isAuthenticated && typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const initData = getTelegramInitData();

      if (initData) {
        apiClient.authenticateWithTelegram(initData).then((response) => {
          if (response.success && response.data?.token) {
            localStorage.setItem('auth_token', response.data.token);
            apiClient.setToken(response.data.token);
            router.replace('/miniphone');
          }
        }).catch((error) => {
          setErrorMsg(error instanceof Error ? error.message : 'Ошибка аутентификации');
        });
      } else {
        setErrorMsg('Данные Telegram недоступны');
      }
    } else if (!isLoading && !isAuthenticated && typeof window !== 'undefined' && !window.Telegram?.WebApp) {
      setErrorMsg('Telegram Web App недоступен');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleRegistrationSuccess = async (token: string) => {
    localStorage.setItem('auth_token', token);
    apiClient.setToken(token);
    
    try {
      const response = await apiClient.verifyToken();
      if (response.success && response.data) {
        router.replace('/miniphone');
      } else {
        console.error('Failed to verify token after registration');
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Проверка аутентификации...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Редирект произойдет через useEffect
  }

  return (
    <AlertProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <FriendlyRetryScreen errorMsg={errorMsg} onRegistrationSuccess={handleRegistrationSuccess} />
      </div>
      <AlertContainer />
    </AlertProvider>
  );
};

export default SignInPage;

