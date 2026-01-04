'use client';

import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from 'react';
import { getTranslations } from './loader';
import type { Translations } from './loader';
import { getLanguageFromCode, type Language, defaultLanguage } from './index';

interface I18nContextValue {
  language: Language;
  t: (msgid: string) => string;
  isLoading: boolean;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  languageCode?: string | null;
  defaultLanguage?: Language;
}

export function I18nProvider({
  children,
  languageCode,
  defaultLanguage: defaultLang = defaultLanguage,
}: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() =>
    languageCode ? getLanguageFromCode(languageCode) : defaultLang
  );
  const [translations, setTranslations] = useState<Translations>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Обновляем язык при изменении languageCode
  useEffect(() => {
    if (languageCode) {
      const newLanguage = getLanguageFromCode(languageCode);
      setLanguageState(newLanguage);
    }
  }, [languageCode]);

  // Загружаем переводы при изменении языка
  useEffect(() => {
    setIsLoading(true);
    getTranslations(language)
      .then((loadedTranslations) => {
        setTranslations(loadedTranslations);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load translations:', error);
        setTranslations(new Map());
        setIsLoading(false);
      });
  }, [language]);

  const translate = useMemo(
    () => (msgid: string): string => {
      if (isLoading) {
        return msgid; // Возвращаем оригинал пока загружаются переводы
      }
      return translations.get(msgid) || msgid;
    },
    [translations, isLoading]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      t: translate,
      isLoading,
      setLanguage: setLanguageState,
    }),
    [language, translate, isLoading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

