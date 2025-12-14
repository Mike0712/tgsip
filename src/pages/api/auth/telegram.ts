import { NextApiRequest, NextApiResponse } from 'next';
import { userService, sessionService } from '../../../lib/database';
import { createToken, validateTelegramData } from '../../../lib/auth';
import logger from '../logger';

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
    const isDev = process.env.NODE_ENV === 'development';
    const { initData, user: userFromBody } = req.body;
    
    logger.info({
      message: '📥 Telegram auth request',
      hasInitData: !!initData,
      hasUserFromBody: !!userFromBody,
      initDataLength: initData?.length,
      initDataPreview: initData?.substring(0, 200),
      nodeEnv: process.env.NODE_ENV,
      isDev,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    });
    
    let parsedUser: TelegramUser | null = null;
    let auth_date = '';
    let hash = '';
    let query_id: string | undefined;
    
    if (isDev) {
      if (userFromBody) {
        try {
          parsedUser = typeof userFromBody === 'string' ? JSON.parse(userFromBody) : userFromBody;
          auth_date = String(Math.floor(Date.now() / 1000));
          hash = 'dev_mode';
        } catch (error) {
          logger.error(error, '❌ Failed to parse user in dev mode');
          return res.status(400).json({ error: 'Invalid user data in dev mode' });
        }
      } else if (initData) {
        try {
          parsedUser = typeof initData === 'string' ? JSON.parse(initData) : initData;
          auth_date = String(Math.floor(Date.now() / 1000));
          hash = 'dev_mode';
        } catch (error) {
          const urlParams = new URLSearchParams(initData);
          const userStr = urlParams.get('user');
          if (userStr) {
            parsedUser = JSON.parse(userStr);
            auth_date = urlParams.get('auth_date') || String(Math.floor(Date.now() / 1000));
            hash = urlParams.get('hash') || 'dev_mode';
          }
        }
      }
      
      if (!parsedUser?.id) {
        return res.status(400).json({ error: 'Telegram user data is required' });
      }
    } else {
      if (!initData) {
        return res.status(400).json({ error: 'Telegram init data is required' });
      }

      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      auth_date = urlParams.get('auth_date') || '';
      hash = urlParams.get('hash') || '';
      query_id = urlParams.get('query_id') || undefined;

      parsedUser = userStr ? JSON.parse(userStr) : null;
    }
    if (!parsedUser?.id) {
      logger.error('❌ No user in initData');
      return res.status(401).json({ error: 'Invalid Telegram init data: no user' });
    }

    logger.info({ message: '✅ User parsed', userId: parsedUser.id, username: parsedUser.username });

    // Проверяем подпись (только в продакшене)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!isDev && botToken) {            
      const isValid = validateTelegramData(initData, botToken);
      if (!isValid) {
        logger.error({
          initData,
          hash,
          hasBotToken: !!botToken
        }, '❌ Telegram signature validation failed');
        // return res.status(401).json({ error: 'Invalid Telegram data signature' });
      } else {
        logger.info('✅ Telegram signature valid');
      }
    } else if (!isDev && !botToken) {
      logger.error('❌ Production mode but TELEGRAM_BOT_TOKEN is missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Проверяем время (данные не старше 24 часов) - только в production и если есть auth_date
    if (!isDev && auth_date) {
      const authDate = parseInt(auth_date) * 1000;
      const now = Date.now();
      const ageInHours = (now - authDate) / (1000 * 60 * 60);
      
      logger.info({
        authDate: new Date(authDate).toISOString(),
        now: new Date(now).toISOString(),
        ageInHours: ageInHours.toFixed(2),
        isValid: now - authDate <= 24 * 60 * 60 * 1000
      }, '⏰ Auth date check');
      
      if (isNaN(authDate) || now - authDate > 24 * 60 * 60 * 1000) {
        logger.error({ 
          authDate: auth_date,
          parsedAuthDate: authDate,
          ageInHours: ageInHours.toFixed(2),
          isNaN: isNaN(authDate)
        }, '❌ Telegram data is too old or invalid');
        return res.status(401).json({ error: 'Telegram data is too old' });
      }
    } else if (!isDev) {
      logger.error('❌ Production mode but auth_date is missing');
      return res.status(401).json({ error: 'Invalid Telegram init data: missing auth_date' });
    }

    // Проверяем существует ли пользователь в базе данных (по telegram_id)
    logger.info({ telegramId: parsedUser.id, telegramIdType: typeof parsedUser.id }, '🔍 Searching user in DB');
    let user = await userService.findByTelegramId(String(parsedUser.id));
    
    logger.info({ 
      found: !!user, 
      userId: user?.id,
      telegramId: user?.telegram_id,
      telegramIdType: typeof user?.telegram_id
    }, '👤 User lookup result');
    
    if (!user) {
      logger.error({ telegramId: parsedUser.id }, '❌ User not found in database');
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
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.headers['x-forwarded-for'] as string || (req.socket as any)?.remoteAddress;
    
    logger.info({
      userId: user.id,
      tokenLength: token.length,
      expiresAt: expiresAt.toISOString(),
      deviceInfo: deviceInfo?.substring(0, 100),
      ipAddress
    }, '🔐 Creating session');
    
    let session;
    try {
      session = await sessionService.create(
        user.id,
        token,
        expiresAt,
        deviceInfo,
        ipAddress
      );
      logger.info({
        sessionId: session.id,
        userId: session.user_id,
        expiresAt: session.expires_at
      }, '✅ Session created successfully');
    } catch (sessionError: any) {
      logger.error({
        error: sessionError.message,
        stack: sessionError.stack,
        userId: user.id,
        errorCode: sessionError.code
      }, '❌ Session creation failed');
      throw sessionError;
    }

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
    logger.error(error, 'Telegram auth error');
    res.status(500).json({ error: 'Internal server error' });
  }
}