import { NextApiRequest, NextApiResponse } from 'next';
import { callTelegram, isTelegramConfigured } from '@/lib/telegram';
import logger from '../logger';

// Companion to set-webhook.ts — same reasoning: getWebhookInfo has to go
// through callTelegram() (TELEGRAM_API_BASE-aware) instead of a direct curl
// to api.telegram.org, which just hangs from this server's network.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!isTelegramConfigured()) {
    return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' });
  }

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth || auth !== process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await callTelegram('getWebhookInfo', {});
    return res.status(result.ok ? 200 : 502).json(result.data);
  } catch (error) {
    logger.error({ error }, '[telegram/webhook-info] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
