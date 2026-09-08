import type { NextApiRequest, NextApiResponse } from 'next';
import { userService } from '@/lib/database';
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, from } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'user_id is required' 
      });
    }

    if (!isTelegramConfigured()) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({
        success: false,
        error: 'Bot token not configured'
      });
    }

    // Получаем данные пользователя по ID
    const user = await userService.findById(parseInt(user_id));

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: `User with ID ${user_id} not found`
      });
    }

    if (!user.telegram_id) {
      return res.status(400).json({ 
        success: false,
        error: 'User has no Telegram ID',
        message: `User ${user_id} is not linked to Telegram`
      });
    }

    // Формируем сообщение
    const callerNumber = from || 'Неизвестный номер';
    const message = `📞 Входящий звонок от ${callerNumber}`;

    // Отправляем уведомление в Telegram (через релей, если задан TELEGRAM_API_BASE)
    const telegramResult = await sendTelegramMessage({
      chat_id: user.telegram_id,
      text: message,
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📞 Ответить',
            web_app: {
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/miniphone`
            }
          }
        ]]
      }
    });

    if (!telegramResult.ok) {
      console.error('Telegram API error:', telegramResult.status, telegramResult.data);
      return res.status(502).json({
        success: false,
        error: 'Failed to send Telegram notification',
        details: telegramResult.data
      });
    }

    console.log(`✅ Notification sent to ${user.first_name} (${user.telegram_id}) for call from ${callerNumber}`);

    res.status(200).json({ 
      success: true,
      message: 'Notification sent successfully',
      recipient: {
        telegram_id: user.telegram_id,
        name: `${user.first_name} ${user.last_name || ''}`.trim()
      }
    });

  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}

