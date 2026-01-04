/**
 * Утилиты для работы с Telegram WebApp
 * Централизованная логика получения initData и initDataUnsafe
 */

/**
 * Получает initData из Telegram WebApp или из URL параметров (в dev режиме)
 * @returns initData строка или null
 */
export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // В production используем Telegram WebApp
  if (process.env.NODE_ENV === 'production') {
    return window.Telegram?.WebApp?.initData || null;
  }

  // В development получаем из URL параметров
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('user');
}

/**
 * Получает initDataUnsafe из Telegram WebApp или из URL параметров (в dev режиме)
 * @returns initDataUnsafe объект или null
 */
export function getTelegramInitDataUnsafe(): {
  user?: {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    added_to_attachment_menu?: boolean;
    allows_write_to_pm?: boolean;
    photo_url?: string;
  };
  auth_date?: number;
  hash?: string;
  start_param?: string;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // В production используем Telegram WebApp
  if (process.env.NODE_ENV === 'production') {
    return window.Telegram?.WebApp?.initDataUnsafe || null;
  }

  // В development получаем из URL параметров
  const searchParams = new URLSearchParams(window.location.search);
  const userParam = searchParams.get('user');
  
  if (!userParam) {
    return null;
  }

  try {
    const decodedParam = decodeURIComponent(userParam);
    const userData = JSON.parse(decodedParam);
    return { user: userData };
  } catch (parseError) {
    console.error('❌ Failed to parse user param:', parseError);
    return null;
  }
}

/**
 * Получает пользователя из Telegram WebApp или из URL параметров (в dev режиме)
 * @returns объект пользователя или null
 */
export function getTelegramUser(): {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
} | null {
  const initDataUnsafe = getTelegramInitDataUnsafe();
  return initDataUnsafe?.user || null;
}

