export type Language = 'ru' | 'en';

export const defaultLanguage: Language = 'en';

// Маппинг language_code от Telegram к нашим языкам
export function getLanguageFromCode(languageCode?: string | null): Language {
  if (!languageCode) {
    return defaultLanguage;
  }

  const code = languageCode.toLowerCase().split('-')[0]; // 'ru-RU' -> 'ru'

  if (code === 'ru') {
    return 'ru';
  }

  // По умолчанию английский для всех остальных
  return 'en';
}

