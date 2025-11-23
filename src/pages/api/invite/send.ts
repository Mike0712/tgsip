import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { userService } from '@/lib/database';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return res.status(500).json({ success: false, error: 'Bot token not configured' });
  }

  try {
    const { telegram_id, link, message } = req.body as {
      telegram_id?: string;
      link?: string;
      message?: string;
    };

    if (!telegram_id || typeof telegram_id !== 'string') {
      return res.status(400).json({ success: false, error: 'telegram_id is required' });
    }

    if (!link || typeof link !== 'string') {
      return res.status(400).json({ success: false, error: 'link is required' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(link);
    } catch {
      return res.status(400).json({ success: false, error: 'link must be a valid URL' });
    }

    const recipient = await userService.findByTelegramId(telegram_id);
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    const initiator = await userService.findById(req.user.userId).catch(() => null);

    const greeting = initiator
      ? `${initiator.first_name}${initiator.last_name ? ` ${initiator.last_name}` : ''}`.trim()
      : 'Ваш коллега';

    const fallbackText = message && typeof message === 'string'
      ? message.trim()
      : `${greeting} приглашает вас присоединиться к звонку.`;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: `${fallbackText}\n\n🔗 ${parsedUrl.toString()}`,
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Открыть Miniphone',
              web_app: { url: parsedUrl.toString() }
            }
          ]],
        },
      }),
    });

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json().catch(() => ({}));
      console.error('Failed to send invite message via Telegram:', errorData);
      return res.status(502).json({ success: false, error: 'Failed to send Telegram message', details: errorData });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Invite send error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);

