'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { MiniPhoneScreen } from '@/widgets/MiniPhone';
import { useAuth } from '@/shared/hooks/useAuth';
import { getTelegramInitData } from '@/shared/lib/telegramUtils';

const MiniPhone = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, loginWithTelegram } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const initData = getTelegramInitData();
      if (initData) {
        loginWithTelegram(initData);
      } else {
        router.replace({
          pathname: '/signin',
          query: router.query,
        });
      }
    }
  }, [isAuthenticated, isLoading, loginWithTelegram, router]);

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

  if (!isAuthenticated || !user) {
    return null;
  }

  return <MiniPhoneScreen user={user} />;
};

export default MiniPhone;
