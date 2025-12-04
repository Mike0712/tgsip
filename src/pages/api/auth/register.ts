import { NextApiRequest, NextApiResponse } from 'next';
import { userService, sessionService, registrationRequestService } from '../../../lib/database';
import { createToken } from '../../../lib/auth';
import { getDb } from '@/lib/db';
import logger from './logger';

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

  logger.info(`📞 Adding user ${telegramId} to Asterisk via ${serverIp}:${webPort}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: telegramId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error({
      url: apiUrl,
      status: response.status,
      error: typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error),
      telegramId
    },'Asterisk API error response');
    throw new Error((typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)) || `Failed to add user to Asterisk (${response.status})`);
  }

  const data = await response.json() as AsteriskResponse;
  
  return data;
}

// ===== Бизнес-логика шагов регистрации =====
async function checkRegistrationRequestOrThrow(telegramId: string) {
  const registrationRequest = await registrationRequestService.findPendingByTelegramId(telegramId);
  if (!registrationRequest) {
    throw { status: 403, error: 'Registration request not found or not approved', step: 'request_check' };
  }
  return registrationRequest;
}

async function findOrCreateUser(db: any, telegramUser: TelegramUser, first_name: string) {
  let user = await userService.findByTelegramId(String(telegramUser.id));
  if (!user) {
    user = await userService.create({
      telegram_id: String(telegramUser.id),
      username: telegramUser.username,
      first_name: first_name.trim(),
      last_name: telegramUser.last_name,
      language_code: telegramUser.language_code,
      is_premium: telegramUser.is_premium || false,
      photo_url: telegramUser.photo_url,
    });
  }
  return user;
}

async function selectServerOrThrow(db: any) {
  const servers = await db('servers').select('id', 'ip', 'web_port', 'url', 'port')
    .whereNotNull('web_port')
    .where('web_port', '>', 0);
  if (servers.length === 0) {
    throw { status: 503, error: 'No servers available', step: 'server_selection' };
  }
  return servers[Math.floor(Math.random() * servers.length)];
}

async function createOrUpdateSipAccount(db: any, user: any, server: any, asteriskResponse: AsteriskResponse) {
  const existingAccount = await db('sip_accounts')
    .where({ user_id: user.id, server_id: server.id, is_active: true })
    .first();
  if (existingAccount) {
    await db('sip_accounts')
      .where('id', existingAccount.id)
      .update({
        sip_username: asteriskResponse.username,
        sip_password: asteriskResponse.password,
        is_active: true,
      });
    return existingAccount.id;
  } else {
    const [sipAccount] = await db('sip_accounts')
      .insert({
        user_id: user.id,
        sip_username: asteriskResponse.username,
        sip_password: asteriskResponse.password,
        server_id: server.id,
        is_active: true,
      })
      .returning('*');
    return sipAccount.id;
  }
}

async function createAndSaveTokenSession(user: any, telegramUser: TelegramUser, req: NextApiRequest) {
  const token = createToken({
    userId: user.id,
    username: user.username,
    telegramId: telegramUser.id,
  });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const deviceInfo = req.headers['user-agent'];
  const ipAddress = req.headers['x-forwarded-for'] as string || (req.socket as any)?.remoteAddress;
  await sessionService.create(user.id, token, expiresAt, deviceInfo, ipAddress);
  return token;
}

// ===== Основной handler с пошаговой логикой =====
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

    let registrationRequest;
    try {
      registrationRequest = await checkRegistrationRequestOrThrow(telegramId);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка в регистрации (request check)');
      return res.status(
        typeof e === 'object' && e && 'status' in e ? (e as any).status : 403
      ).json({
        error: typeof e === 'object' && e && 'error' in e ? String((e as any).error) : (e instanceof Error ? e.message : String(e)),
        step: typeof e === 'object' && e && 'step' in e ? String((e as any).step) : undefined,
      });
    }

    let user;
    try {
      user = await findOrCreateUser(db, telegramUser, first_name);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка создания пользователя');
      return res.status(500).json({ error: 'User creation failed', detail: e instanceof Error ? e.message : String(e) });
    }

    let selectedServer;
    try {
      selectedServer = await selectServerOrThrow(db);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка выбора сервера');
      return res.status(
        typeof e === 'object' && e && 'status' in e ? (e as any).status : 503
      ).json({
        error: typeof e === 'object' && e && 'error' in e ? String((e as any).error) : (e instanceof Error ? e.message : String(e)),
        step: typeof e === 'object' && e && 'step' in e ? String((e as any).step) : undefined,
      });
    }

    let asteriskResponse;
    try {
      asteriskResponse = await addUserToAsterisk(telegramId, selectedServer.ip, selectedServer.web_port);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка вызова addUserToAsterisk');
      return res.status(502).json({ error: e instanceof Error ? e.message : String(e) || 'Failed to add user to Asterisk', step: 'asterisk_call' });
    }

    try {
      await createOrUpdateSipAccount(db, user, selectedServer, asteriskResponse);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка создания SIP-аккаунта');
      if (typeof e === 'object' && e && 'code' in e && (e as any).code === '23505') {
        return res.status(409).json({ error: 'SIP account already exists', step: 'sip_account_creation' });
      }
      return res.status(500).json({ error: 'Failed to create SIP account', step: 'sip_account_creation', detail: e instanceof Error ? e.message : String(e) });
    }

    let token;
    try {
      token = await createAndSaveTokenSession(user, telegramUser, req);
    } catch (e: unknown) {
      logger.error({
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error && e.stack ? e.stack : undefined
      },'Ошибка создания сессии');
      return res.status(500).json({ error: 'Failed to create session', detail: e instanceof Error ? e.message : String(e) });
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
        photo_url: user.photo_url,
      },
    });
  } catch (error: unknown) {
    logger.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error && error.stack ? error.stack : undefined
    },'Internal registration error');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
