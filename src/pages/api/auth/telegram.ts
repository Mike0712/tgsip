// src/pages/api/auth/telegram.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { userService, sessionService } from '../../../lib/database';
import { createToken, validateTelegramData } from '../../../lib/auth';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'Telegram init data is required' });
    }

    // Парсим данные от Telegram WebApp: важные ключи: user (JSON), auth_date, hash, query_id
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    const auth_date = urlParams.get('auth_date') || '';
    const hash = urlParams.get('hash') || '';
    const query_id = urlParams.get('query_id') || undefined;

    const parsedUser: TelegramUser | null = userStr ? JSON.parse(userStr) : null;
    if (!parsedUser?.id) {
      return res.status(401).json({ error: 'Invalid Telegram init data: no user' });
    }

    // Проверяем подпись (в продакшене)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (process.env.NODE_ENV === 'production' && botToken) {
      // Формируем объект как в документации: все поля кроме hash; user = исходная JSON-строка
      const dataForValidation: Record<string, string> = {
        auth_date,
        ...(query_id ? { query_id } : {}),
        ...(userStr ? { user: userStr } : {}),
      };
      if (!validateTelegramData({ ...dataForValidation, hash }, botToken)) {
        return res.status(401).json({ error: 'Invalid Telegram data signature' });
      }
    }

    // Проверяем время (данные не старше 24 часов)
    const authDate = parseInt(auth_date) * 1000;
    const now = Date.now();
    if (now - authDate > 24 * 60 * 60 * 1000) {
      return res.status(401).json({ error: 'Telegram data is too old' });
    }

    // Проверяем существует ли пользователь в базе данных (по telegram_id)
    let user = await userService.findByTelegramId(String(parsedUser.id));
    
    if (!user) {
      // Пользователь не найден - доступ запрещен
      return res.status(403).json({ 
        success: false,
        error: 'Access denied',
        message: 'Пользователь не найден в системе. Обратитесь к администратору для получения доступа.'
      });
    }

    // Обновляем информацию о пользователе
    user = await userService.update(user.id, {
      username: parsedUser.username,
      first_name: parsedUser.first_name,
      last_name: parsedUser.last_name,
      language_code: parsedUser.language_code,
      is_premium: parsedUser.is_premium || false,
      photo_url: parsedUser.photo_url
    });
    
    // Обновляем время последнего входа
    await userService.updateLastSeen(user.id);

    // Создаем JWT токен
    const token = createToken({
      userId: user.id,
      username: user.username,
      telegramId: parsedUser.id
    });

    // Создаем сессию в базе данных
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    await sessionService.create(
      user.id,
      token,
      expiresAt,
      req.headers['user-agent'],
      req.headers['x-forwarded-for'] as string || (req.socket as any)?.remoteAddress
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: user.photo_url
      }
    });

  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
