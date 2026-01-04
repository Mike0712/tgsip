import { useI18n } from '@/shared/lib/i18n/I18nProvider';

/**
 * Хук для использования переводов (gettext style)
 * @example
 * const t = useTranslation();
 * <div>{t('Loading...')}</div>
 */
export function useTranslation() {
  const { t } = useI18n();
  return t;
}

