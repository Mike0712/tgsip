'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { I18nProvider } from './I18nProvider';
import { getTelegramUser } from '@/shared/lib/telegramUtils';

interface I18nWrapperProps {
  children: ReactNode;
}

/**
 * Обертка для автоматического определения языка по language_code из Telegram WebApp
 * Работает как в production (через Telegram WebApp), так и в development (через URL параметры)
 */
export function I18nWrapper({ children }: I18nWrapperProps) {
  const [languageCode, setLanguageCode] = useState<string | null>(null);

  useEffect(() => {
    // Получаем language_code через утилиту, которая работает в обоих режимах
    const getLanguageCode = (): string | null => {
      const user = getTelegramUser();
      return user?.language_code || null;
    };

    // Проверяем сразу
    const code = getLanguageCode();
    if (code) {
      setLanguageCode(code);
      return;
    }

    // Если WebApp еще не загружен, пробуем через небольшую задержку
    const timeout = setTimeout(() => {
      const code = getLanguageCode();
      if (code) {
        setLanguageCode(code);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <I18nProvider languageCode={languageCode}>
      {children}
    </I18nProvider>
  );
}

