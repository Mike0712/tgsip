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
    
    console.log('📥 Telegram auth request:', {
      hasInitData: !!initData,
      initDataLength: initData?.length,
      initDataPreview: initData?.substring(0, 200),
      nodeEnv: process.env.NODE_ENV,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    });
    
    if (!initData) {
      return res.status(400).json({ error: 'Telegram init data is required' });
    }

    // Парсим данные от Telegram WebApp: важные ключи: user (JSON), auth_date, hash, query_id
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    const auth_date = urlParams.get('auth_date') || '';
    const hash = urlParams.get('hash') || '';
    const query_id = urlParams.get('query_id') || undefined;

    console.log('🔍 Parsed initData:', {
      hasUser: !!userStr,
      hasAuthDate: !!auth_date,
      hasHash: !!hash,
      hasQueryId: !!query_id,
      authDate: auth_date,
      userPreview: userStr?.substring(0, 100),
    });

    const parsedUser: TelegramUser | null = userStr ? JSON.parse(userStr) : null;
    if (!parsedUser?.id) {
      console.error('❌ No user in initData');
      return res.status(401).json({ error: 'Invalid Telegram init data: no user' });
    }

    console.log('✅ User parsed:', { userId: parsedUser.id, username: parsedUser.username });

    // Проверяем подпись (в продакшене)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && botToken) {
      // Парсим initData вручную, чтобы сохранить оригинальные значения
      // Telegram может отправлять URL-encoded значения
      const params: Record<string, string> = {};
      const pairs = initData.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value && key !== 'hash' && key !== 'signature') {
          params[key] = decodeURIComponent(value);
        }
      }
      
      console.log('🔐 Validating Telegram signature in production...', {
        hasBotToken: !!botToken,
        dataKeys: Object.keys(params),
        hash: hash ? 'present' : 'missing'
      });
      
      const isValid = validateTelegramData({ ...params, hash }, botToken);
      if (!isValid) {
        console.error('❌ Telegram signature validation failed', {
          dataKeys: Object.keys(params),
          hash,
          hasBotToken: !!botToken
        });
        return res.status(401).json({ error: 'Invalid Telegram data signature' });
      } else {
        console.log('✅ Telegram signature valid');
      }
    } else if (isProduction && !botToken) {
      console.error('❌ Production mode but TELEGRAM_BOT_TOKEN is missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Проверяем время (данные не старше 24 часов) - только если есть auth_date
    if (auth_date) {
      const authDate = parseInt(auth_date) * 1000;
      const now = Date.now();
      const ageInHours = (now - authDate) / (1000 * 60 * 60);
      
      console.log('⏰ Auth date check:', {
        authDate: new Date(authDate).toISOString(),
        now: new Date(now).toISOString(),
        ageInHours: ageInHours.toFixed(2),
        isValid: now - authDate <= 24 * 60 * 60 * 1000
      });
      
      if (isNaN(authDate) || now - authDate > 24 * 60 * 60 * 1000) {
        console.error('❌ Telegram data is too old or invalid:', { 
          authDate: auth_date,
          parsedAuthDate: authDate,
          ageInHours: ageInHours.toFixed(2),
          isNaN: isNaN(authDate)
        });
        return res.status(401).json({ error: 'Telegram data is too old' });
      }
    } else if (isProduction) {
      console.error('❌ Production mode but auth_date is missing');
      return res.status(401).json({ error: 'Invalid Telegram init data: missing auth_date' });
    }

    // Проверяем существует ли пользователь в базе данных (по telegram_id)
    console.log('🔍 Searching user in DB:', { telegramId: parsedUser.id, telegramIdType: typeof parsedUser.id });
    let user = await userService.findByTelegramId(String(parsedUser.id));
    
    console.log('👤 User lookup result:', { 
      found: !!user, 
      userId: user?.id,
      telegramId: user?.telegram_id,
      telegramIdType: typeof user?.telegram_id
    });
    
    if (!user) {
      // Пользователь не найден - доступ запрещен
      console.error('❌ User not found in database:', { telegramId: parsedUser.id });
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