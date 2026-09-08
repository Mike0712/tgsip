/**
 * Обёртка над Telegram Bot API.
 *
 * В регионах, где api.telegram.org заблокирован, запросы идут через релей `tgproxy`.
 * Достаточно выставить env:
 *
 *   TELEGRAM_API_BASE=http://<tgproxy_ip>:<port>
 *
 * По умолчанию (переменная не задана) обращаемся напрямую к https://api.telegram.org.
 */

const DEFAULT_TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 10_000;

/** Базовый URL Telegram Bot API (без завершающего слэша). */
export function getTelegramApiBase(): string {
  return (process.env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API_BASE).replace(/\/+$/, '');
}

/** Настроен ли бот (есть токен). */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export class TelegramNotConfiguredError extends Error {
  constructor() {
    super('TELEGRAM_BOT_TOKEN is not configured');
    this.name = 'TelegramNotConfiguredError';
  }
}

export interface TelegramCallResult<T = unknown> {
  /** true, если HTTP-ответ 2xx и Telegram вернул ok: true */
  ok: boolean;
  /** HTTP-статус ответа (релея/Telegram) */
  status: number;
  /** Тело ответа Telegram как есть */
  data: T & { ok?: boolean; description?: string; error_code?: number };
}

/**
 * Вызов произвольного метода Bot API.
 * Бросает, если не настроен токен, при сетевой ошибке или таймауте.
 */
export async function callTelegram<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<TelegramCallResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new TelegramNotConfiguredError();
  }

  const url = `${getTelegramApiBase()}/bot${token}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as TelegramCallResult<T>['data'];

  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    data,
  };
}

export interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  reply_markup?: unknown;
  [key: string]: unknown;
}

/** Отправка текстового сообщения. */
export function sendTelegramMessage(
  params: SendMessageParams,
  options?: { timeoutMs?: number },
): Promise<TelegramCallResult> {
  return callTelegram('sendMessage', params, options);
}
