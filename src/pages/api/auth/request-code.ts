import { NextApiRequest, NextApiResponse } from 'next';
import { userService, loginCodeService } from '../../../lib/database';
import { isTelegramConfigured, sendTelegramMessage } from '../../../lib/telegram';
import logger from '../logger';

// Логин мобильного приложения (mobile/): приложение уже знает свой user_id
// (EXPO_PUBLIC_USER_ID), но не аутентифицировано — этот эндпоинт шлёт
// одноразовый код в Telegram-аккаунт, привязанный к этому user_id при
// исходной web-регистрации. Какой Telegram-аккаунт сейчас активен на
// телефоне — не важно, код всегда уходит на конкретный telegram_id.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.body || {};
    if (!user_id || typeof user_id !== 'number') {
      return res.status(400).json({ success: false, error: 'user_id (number) is required' });
    }

    const user = await userService.findById(user_id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!isTelegramConfigured()) {
      logger.error('[auth/request-code] TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ success: false, error: 'Telegram not configured' });
    }

    const loginCode = await loginCodeService.create(user.id);

    const telegramResult = await sendTelegramMessage({
      chat_id: user.telegram_id,
      text: `🔐 Код для входа в MiniPhone: ${loginCode.code}\n\nДействует 5 минут.`,
    });

    if (!telegramResult.ok) {
      logger.error({ status: telegramResult.status }, '[auth/request-code] Failed to send Telegram message');
      return res.status(502).json({ success: false, error: 'Failed to send Telegram message' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, '[auth/request-code] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
