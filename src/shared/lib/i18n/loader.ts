import ruTranslations from './translations/ru.json';
import enTranslations from './translations/en.json';

export type Translations = Map<string, string>;

const translationFiles: Record<string, Record<string, string>> = {
  ru: ruTranslations,
  en: enTranslations,
};

export async function loadTranslations(locale: string): Promise<Translations> {
  try {
    const translationsObj = translationFiles[locale];
    
    if (!translationsObj) {
      console.warn(`No translations found for locale: ${locale}, using default`);
      return new Map();
    }

    const translations = new Map<string, string>();
    for (const [key, value] of Object.entries(translationsObj)) {
      translations.set(key, value);
    }

    return translations;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);
    return new Map();
  }
}

const translationsCache = new Map<string, Translations>();

export async function getTranslations(locale: string): Promise<Translations> {
  if (translationsCache.has(locale)) {
    return translationsCache.get(locale)!;
  }

  const translations = await loadTranslations(locale);
  translationsCache.set(locale, translations);
  return translations;
}

