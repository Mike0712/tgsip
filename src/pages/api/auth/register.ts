import { NextApiRequest, NextApiResponse } from 'next';
import { userService, sessionService, registrationRequestService } from '../../../lib/database';
import { createToken } from '../../../lib/auth';
import { getDb } from '@/lib/db';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface AsteriskResponse {
  password: string;
  username: string;
}

// Получаем данные Telegram из initData
function getTelegramUser(req: NextApiRequest): TelegramUser | null {
  // В production используем initData из body
  if (process.env.NODE_ENV === 'production') {
    const { initData } = req.body;
    if (!initData) return null;
    
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return null;
    
    return JSON.parse(userStr);
  }
  
  // В dev режиме берем из URL или body
  const { user } = req.body;
  if (user) {
    return typeof user === 'string' ? JSON.parse(user) : user;
  }
  
  return null;
}

// Добавляем пользователя в Asterisk и получаем учетные данные
async function addUserToAsterisk(telegramId: string, serverIp: string, webPort: number): Promise<AsteriskResponse> {
  const apiUrl = `http://${serverIp}:${webPort}/api/add`;

  console.log(`📞 Adding user ${telegramId} to Asterisk via ${serverIp}:${webPort}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: telegramId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to add user to Asterisk (${response.status})`);
  }

  const data = await response.json() as AsteriskResponse;
  console.log('✅ User added to Asterisk:', { username: data.username, passwordLength: data.password.length });
  
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { first_name } = req.body;
    
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      return res.status(400).json({ error: 'first_name is required' });
    }

    const telegramUser = getTelegramUser(req);
    if (!telegramUser?.id) {
      return res.status(400).json({ error: 'Telegram user data is required' });
    }

    const telegramId = String(telegramUser.id);
    const db = getDb();

    // Шаг 1: Проверяем заявку в registration_requests
    console.log('📋 Step 1: Checking registration request for telegram_id:', telegramId);
    const registrationRequest = await registrationRequestService.findPendingByTelegramId(telegramId);
    
    if (!registrationRequest) {
      console.error('❌ No pending registration request found');
      return res.status(403).json({ 
        error: 'Registration request not found or not approved',
        step: 'request_check'
      });
    }

    console.log('✅ Registration request found:', registrationRequest.id);

    // Шаг 2: Проверяем или создаем пользователя в users
    console.log('👤 Step 2: Checking/creating user');
    let user = await userService.findByTelegramId(telegramId);
    
    if (!user) {
      console.log('📝 Creating new user');
      user = await userService.create({
        telegram_id: telegramId,
        username: telegramUser.username,
        first_name: first_name.trim(),
        last_name: telegramUser.last_name,
        language_code: telegramUser.language_code,
        is_premium: telegramUser.is_premium || false,
        photo_url: telegramUser.photo_url,
      });
      console.log('✅ User created:', user.id);
    } else {
      console.log('✅ User already exists:', user.id);
      // Проверяем, есть ли уже активный SIP аккаунт
      const existingSipAccounts = await db('sip_accounts')
        .where('user_id', user.id)
        .where('is_active', true);
      if (existingSipAccounts.length > 0) {
        console.log('⚠️ User already has SIP account(s), proceeding with registration anyway');
      }
    }

    // Шаг 3: Получаем сервер и отправляем запрос на Asterisk
    console.log('🌐 Step 3: Getting server and calling Asterisk API');
    const servers = await db('servers')
      .select('id', 'ip', 'web_port', 'url', 'port')
      .whereNotNull('web_port')
      .where('web_port', '>', 0);

    if (servers.length === 0) {
      console.error('❌ No servers available');
      return res.status(503).json({ 
        error: 'No servers available',
        step: 'server_selection'
      });
    }

    // Выбираем случайный сервер
    const selectedServer = servers[Math.floor(Math.random() * servers.length)];
    console.log('📡 Selected server:', selectedServer.id, selectedServer.ip, selectedServer.web_port);

    // Вызываем Asterisk API
    let asteriskResponse: AsteriskResponse;
    try {
      asteriskResponse = await addUserToAsterisk(telegramId, selectedServer.ip, selectedServer.web_port);
    } catch (error) {
      console.error('❌ Failed to add user to Asterisk:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to add user to Asterisk',
        step: 'asterisk_call'
      });
    }

    // Шаг 4: Создаем запись в sip_accounts
    console.log('💾 Step 4: Creating SIP account record');
    try {
      // Проверяем, нет ли уже SIP аккаунта для этого пользователя на этом сервере
      const existingAccount = await db('sip_accounts')
        .where({ 
          user_id: user.id, 
          server_id: selectedServer.id,
          is_active: true 
        })
        .first();

      if (existingAccount) {
        console.log('⚠️ SIP account already exists for this user and server, updating...');
        // Обновляем существующий аккаунт
        await db('sip_accounts')
          .where('id', existingAccount.id)
          .update({
            sip_username: asteriskResponse.username,
            sip_password: asteriskResponse.password,
            is_active: true
          });
        console.log('✅ SIP account updated:', existingAccount.id);
      } else {
        // Создаем новый аккаунт
        const [sipAccount] = await db('sip_accounts')
          .insert({
            user_id: user.id,
            sip_username: asteriskResponse.username,
            sip_password: asteriskResponse.password,
            server_id: selectedServer.id,
            is_active: true
          })
          .returning('*');
        console.log('✅ SIP account created:', sipAccount.id);
      }
    } catch (error: any) {
      console.error('❌ Failed to create SIP account:', error);
      // Если пользователь уже существует, но SIP аккаунт не создан - можно повторить
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          error: 'SIP account already exists',
          step: 'sip_account_creation'
        });
      }
      return res.status(500).json({
        error: 'Failed to create SIP account',
        step: 'sip_account_creation'
      });
    }

    // Шаг 5: Создаем токен и сессию
    console.log('🔐 Step 5: Creating token and session');
    const token = createToken({
      userId: user.id,
      username: user.username,
      telegramId: telegramUser.id
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.headers['x-forwarded-for'] as string || (req.socket as any)?.remoteAddress;
    
    await sessionService.create(
      user.id,
      token,
      expiresAt,
      deviceInfo,
      ipAddress
    );

    console.log('✅ Registration completed successfully');

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
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
