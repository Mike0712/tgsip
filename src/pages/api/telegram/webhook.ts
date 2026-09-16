import { NextApiRequest, NextApiResponse } from 'next';
import { userService, telegramLoginService, sessionService } from '@/lib/database';
import { createToken } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import logger from '../logger';

interface TelegramUpdate {
  message?: {
    text?: string;
    from?: { id: number };
    chat?: { id: number };
  };
}

// Step 2: Telegram calls this (must be registered once via setWebhook — see
// mobile/AGENTS.md notes) whenever a user sends /start <token> to our bot,
// which is what happens when the mobile app opens t.me/<bot>?start=<token>
// (start.ts) and the user taps Start. We resolve their telegram_id to a
// tgsip user and hand the mobile app's poll.ts a JWT to pick up.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Telegram echoes back whatever secret_token was passed to setWebhook —
  // rejects anything that didn't actually come from Telegram.
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).end();
  }

  const update = req.body as TelegramUpdate;
  const text = update.message?.text;
  const telegramId = update.message?.from?.id;
  const chatId = update.message?.chat?.id;

  const isStart = text === '/start' || text?.startsWith('/start ') || text?.startsWith('/start@');
  if (!isStart || !telegramId || !chatId) {
    // Not our /start deep link (some other message/command) — ignore.
    return res.status(200).end();
  }

  const match = text?.match(/^\/start(?:@\S+)?\s+(\S+)/);
  const loginToken = match?.[1];

  try {
    // Some Telegram clients drop the ?start= payload for a chat the user
    // already had open with this bot, sending bare /start instead — fall
    // back to the latest pending request in that case (see findLatestPending).
    const request = loginToken
      ? await telegramLoginService.findByToken(loginToken)
      : await telegramLoginService.findLatestPending();
    if (!request || request.status !== 'pending' || request.expires_at.getTime() < Date.now()) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: 'Ссылка для входа устарела. Откройте вход в приложении MiniPhone заново.',
      });
      return res.status(200).end();
    }

    const user = await userService.findByTelegramId(String(telegramId));
    if (!user) {
      await telegramLoginService.markNotFound(request.token);
      await sendTelegramMessage({
        chat_id: chatId,
        text: 'Этот Telegram-аккаунт не зарегистрирован в MiniPhone. Обратитесь к администратору.',
      });
      return res.status(200).end();
    }

    const jwtToken = createToken({
      userId: user.id,
      username: user.username,
      telegramId: Number(user.telegram_id),
    });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sessionService.create(user.id, jwtToken, expiresAt, 'mobile-telegram-login');
    await telegramLoginService.confirm(request.token, user.id, jwtToken);

    await sendTelegramMessage({
      chat_id: chatId,
      text: '✅ Вход подтверждён — вернитесь в приложение MiniPhone.',
    });
  } catch (error) {
    logger.error({ error }, '[telegram/webhook] Unexpected error');
  }

  return res.status(200).end();
}
