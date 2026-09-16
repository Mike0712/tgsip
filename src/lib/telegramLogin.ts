import { userService, telegramLoginService, sessionService } from './database';
import { createToken } from './auth';
import { sendTelegramMessage } from './telegram';
import logger from '../pages/api/logger';

interface TelegramMessage {
  text?: string;
  from?: { id: number };
  chat?: { id: number };
}

// Shared by the getUpdates poller (src/workers/telegramPoller.ts) — used to
// be a webhook handler, but Telegram's servers can't reliably reach a
// Russia-hosted webhook URL (inbound connections get dropped the same way
// outbound ones to api.telegram.org do — see tgproxy), so we pull updates
// instead of having Telegram push them to us.
//
// Handles /start <token> (from the mobile app's t.me/<bot>?start=<token>
// deep link) and resolves telegram_id -> tgsip user, minting a JWT the app
// picks up via poll.ts. Some Telegram clients drop the ?start= payload for
// a chat the user already had open with this bot, sending bare /start
// instead — we fall back to the latest still-pending login request in that
// case (see telegramLoginService.findLatestPending).
export async function processTelegramMessage(message: TelegramMessage): Promise<void> {
  const text = message.text;
  const telegramId = message.from?.id;
  const chatId = message.chat?.id;

  const isStart = text === '/start' || text?.startsWith('/start ') || text?.startsWith('/start@');
  if (!isStart || !telegramId || !chatId) {
    return;
  }

  const match = text?.match(/^\/start(?:@\S+)?\s+(\S+)/);
  const loginToken = match?.[1];

  try {
    const request = loginToken
      ? await telegramLoginService.findByToken(loginToken)
      : await telegramLoginService.findLatestPending();
    if (!request || request.status !== 'pending' || request.expires_at.getTime() < Date.now()) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: 'Ссылка для входа устарела. Откройте вход в приложении MiniPhone заново.',
      });
      return;
    }

    const user = await userService.findByTelegramId(String(telegramId));
    if (!user) {
      await telegramLoginService.markNotFound(request.token);
      await sendTelegramMessage({
        chat_id: chatId,
        text: 'Этот Telegram-аккаунт не зарегистрирован в MiniPhone. Обратитесь к администратору.',
      });
      return;
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
    logger.error({ error }, '[telegramLogin] Unexpected error processing /start');
  }
}
