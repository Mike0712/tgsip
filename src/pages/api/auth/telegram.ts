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
    
    console.log('📥 Telegram auth request received:', {
      hasInitData: !!initData,
      initDataLength: initData?.length,
      initDataPreview: initData?.substring(0, 100),
      isDev: process.env.NODE_ENV === 'development',
    });
    
    if (!initData) {
      return res.status(400).json({ error: 'Telegram init data is required' });
    }

    let parsedUser: TelegramUser | null = null;
    let auth_date: string = '';
    let hash: string = '';

    // В dev режиме initData может быть просто JSON строкой с user
    if (process.env.NODE_ENV === 'development') {
      try {
        // Пытаемся распарсить как JSON напрямую
        const parsed = JSON.parse(initData);
        if (parsed.id) {
          parsedUser = parsed;
          // Создаем фиктивные данные для dev режима
          auth_date = String(Math.floor(Date.now() / 1000));
          hash = 'dev-mode-hash';
          if (parsedUser) {
            console.log('✅ Dev mode: parsed user from JSON:', { userId: parsedUser.id });
          }
        }
      } catch {
        // Если не JSON, пробуем как URLSearchParams (как в production)
      }
    }

    // Если не распарсили в dev режиме, используем стандартный формат Telegram
    if (!parsedUser) {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      auth_date = urlParams.get('auth_date') || '';
      hash = urlParams.get('hash') || '';

      console.log('🔍 Parsed initData:', {
        hasUser: !!userStr,
        hasAuthDate: !!auth_date,
        hasHash: !!hash,
        authDate: auth_date,
      });

      parsedUser = userStr ? JSON.parse(userStr) : null;
    }

    if (!parsedUser?.id) {
      console.error('❌ No user in initData:', { initData: initData?.substring(0, 200) });
      return res.status(401).json({ error: 'Invalid Telegram init data: no user' });
    }

    console.log('✅ User parsed:', { userId: parsedUser.id, username: parsedUser.username });

    // Проверяем подпись (только в продакшене)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (process.env.NODE_ENV === 'production' && botToken) {
      const urlParams = new URLSearchParams(initData);
      const dataForValidation: Record<string, string> = {};
      Array.from(urlParams.entries()).forEach(([key, value]) => {
        if (key !== 'hash' && value) {
          dataForValidation[key] = value;
        }
      });
      console.log('🔐 Validating Telegram signature in production...', {
        hasBotToken: !!botToken,
        dataKeys: Object.keys(dataForValidation),
        hash: hash ? 'present' : 'missing'
      });
      if (!validateTelegramData({ ...dataForValidation, hash }, botToken)) {
        console.error('❌ Telegram signature validation failed', {
          dataKeys: Object.keys(dataForValidation),
          hash,
          hasBotToken: !!botToken
        });
        return res.status(401).json({ error: 'Invalid Telegram data signature' });
      } else {
        console.log('✅ Telegram signature valid');
      }
    }

    // Проверяем время (данные не старше 24 часов) - только в production
    if (process.env.NODE_ENV === 'production' && auth_date) {
      const authDate = parseInt(auth_date) * 1000;
      const now = Date.now();
      const ageInHours = (now - authDate) / (1000 * 60 * 60);
      console.log('⏰ Auth date check:', {
        authDate: new Date(authDate).toISOString(),
        now: new Date(now).toISOString(),
        ageInHours: ageInHours.toFixed(2),
        isValid: now - authDate <= 24 * 60 * 60 * 1000
      });
      
      if (now - authDate > 24 * 60 * 60 * 1000) {
        console.error('❌ Telegram data is too old:', { ageInHours });
        return res.status(401).json({ error: 'Telegram data is too old' });
      }
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
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.headers['x-forwarded-for'] as string || (req.socket as any)?.remoteAddress;
    
    console.log('🔐 Creating session...', {
      userId: user.id,
      tokenLength: token.length,
      expiresAt: expiresAt.toISOString(),
      deviceInfo: deviceInfo?.substring(0, 100),
      ipAddress
    });
    
    let session;
    try {
      session = await sessionService.create(
        user.id,
        token,
        expiresAt,
        deviceInfo,
        ipAddress
      );
      console.log('✅ Session created successfully:', {
        sessionId: session.id,
        userId: session.user_id,
        expiresAt: session.expires_at
      });
    } catch (sessionError: any) {
      console.error('❌ Session creation failed:', {
        error: sessionError.message,
        stack: sessionError.stack,
        userId: user.id,
        errorCode: sessionError.code
      });
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
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
