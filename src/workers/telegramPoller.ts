/**
 * Long-polls Telegram's getUpdates instead of a webhook — Telegram's
 * servers can't reliably open an inbound connection to this (Russia-hosted)
 * server (see the "Connection timed out" getWebhookInfo errors this
 * replaced), but our own outbound calls to Telegram already work fine via
 * tgproxy (TELEGRAM_API_BASE). Long-polling only ever needs outbound
 * connections initiated by us, so it sidesteps the problem entirely.
 *
 * Run as its own always-on process (like tgproxy) — NOT part of the Next.js
 * request/response server:
 *   npx tsx src/workers/telegramPoller.ts
 * Needs the same env as the main app (TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE,
 * JWT_SECRET, DB_*, ...).
 */
import { callTelegram, isTelegramConfigured } from '../lib/telegram';
import { processTelegramMessage } from '../lib/telegramLogin';
import logger from '../pages/api/logger';

const POLL_TIMEOUT_SEC = 30;
const ERROR_BACKOFF_MS = 5000;

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    from?: { id: number };
    chat?: { id: number };
  };
}

async function ensureNoWebhook(): Promise<void> {
  // getUpdates fails outright while a webhook URL is still registered —
  // clear it on every start so the worker is self-sufficient.
  const result = await callTelegram('deleteWebhook', {});
  if (!result.ok) {
    logger.warn({ result: result.data }, '[telegramPoller] deleteWebhook failed (continuing anyway)');
  }
}

async function pollOnce(offset: number | undefined): Promise<number | undefined> {
  const result = await callTelegram('getUpdates', {
    offset,
    timeout: POLL_TIMEOUT_SEC,
    allowed_updates: ['message'],
  }, { timeoutMs: (POLL_TIMEOUT_SEC + 10) * 1000 });

  if (!result.ok) {
    throw new Error(`getUpdates failed: ${JSON.stringify(result.data)}`);
  }

  const data = result.data as { result?: TelegramUpdate[] };
  const updates = data.result ?? [];
  let nextOffset = offset;

  for (const update of updates) {
    nextOffset = update.update_id + 1;
    if (update.message) {
      await processTelegramMessage(update.message).catch((error) =>
        logger.error({ error, update_id: update.update_id }, '[telegramPoller] Failed to process update')
      );
    }
  }

  return nextOffset;
}

async function main() {
  if (!isTelegramConfigured()) {
    logger.error('[telegramPoller] TELEGRAM_BOT_TOKEN not configured — exiting');
    process.exit(1);
  }

  await ensureNoWebhook();
  logger.info('[telegramPoller] Started, long-polling getUpdates');

  // Offset is tracked in-memory only — on restart Telegram will redeliver
  // whatever wasn't acknowledged (at most the handful of messages from
  // while the worker was down), which processTelegramMessage handles
  // idempotently enough for this app's scale (see its own comments).
  let offset: number | undefined;

  for (;;) {
    try {
      offset = await pollOnce(offset);
    } catch (error) {
      logger.error({ error }, '[telegramPoller] Poll iteration failed, backing off');
      await new Promise((resolve) => setTimeout(resolve, ERROR_BACKOFF_MS));
    }
  }
}

main();
