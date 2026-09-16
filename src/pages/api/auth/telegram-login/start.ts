import { NextApiRequest, NextApiResponse } from 'next';
import { telegramLoginService } from '@/lib/database';
import { isTelegramConfigured } from '@/lib/telegram';
import logger from '../../logger';

// Step 1 of the mobile app's Telegram deep-link login (see AGENTS notes in
// mobile/src/screens/LoginScreen.tsx): creates a pending row keyed by a
// one-time token, before we know which Telegram account is logging in.
// The app then opens t.me/<bot_username>?start=<token> and polls poll.ts.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!isTelegramConfigured()) {
    logger.error('[auth/telegram-login/start] TELEGRAM_BOT_TOKEN not configured');
    return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    logger.error('[auth/telegram-login/start] TELEGRAM_BOT_USERNAME not configured');
    return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_USERNAME is not configured on the server' });
  }

  try {
    const request = await telegramLoginService.create();
    return res.status(200).json({ success: true, token: request.token, bot_username: botUsername });
  } catch (error) {
    logger.error({ error }, '[auth/telegram-login/start] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
