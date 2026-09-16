import { NextApiRequest, NextApiResponse } from 'next';
import { callTelegram, isTelegramConfigured } from '@/lib/telegram';
import logger from '../logger';

// One-off admin operation: (re)registers the bot's webhook URL with
// Telegram. Exists because api.telegram.org is blocked from this server's
// network — calling it via `curl` directly (bypassing tgproxy) just hangs.
// This route runs inside the already-configured Next process, so it goes
// through callTelegram()/getTelegramApiBase() (lib/telegram.ts), which
// already routes through TELEGRAM_API_BASE (tgproxy) when set.
//
// Auth: caller must know TELEGRAM_BOT_TOKEN itself (sent as Bearer) — same
// credential the bot already trusts, not a new secret to manage.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!isTelegramConfigured()) {
    return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' });
  }

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth || auth !== process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url (string) is required' });
  }

  try {
    const result = await callTelegram('setWebhook', {
      url,
      ...(process.env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET } : {}),
    });
    return res.status(result.ok ? 200 : 502).json(result.data);
  } catch (error) {
    logger.error({ error }, '[telegram/set-webhook] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
