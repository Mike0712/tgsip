import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { sessionService } from './database';

interface JWTPayload {
  userId: number;
  username?: string;
  telegramId: number;
  sessionId?: number;
}

export interface AuthenticatedRequest extends NextApiRequest {
  user: JWTPayload;
}

// Middleware для проверки JWT токена
export function authenticateToken(req: NextApiRequest): JWTPayload | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
  } catch {
    return null;
  }
}

// Middleware для проверки сессии в базе данных
export async function authenticateSession(req: NextApiRequest): Promise<JWTPayload | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    // Проверяем токен
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
    
    // Проверяем сессию в базе данных
    const session = await sessionService.findByToken(token);
    if (!session) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// HOC для защищенных API роутов
export function withAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await authenticateSession(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as AuthenticatedRequest).user = user;
    return handler(req as AuthenticatedRequest, res);
  };
}

// Создание JWT токена
export function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '7d'
  });
}

// Проверка Telegram данных
export function validateTelegramData(data: any, botToken: string): boolean {
  const crypto = require('crypto');
  const { hash, ...userData } = data;
  
  if (!hash) {
    console.error('❌ validateTelegramData: hash is missing');
    return false;
  }
  
  // Создаем строку для проверки (важно: сортировка по алфавиту)
  const dataCheckString = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`)
    .join('\n');
  
  console.log('🔐 Validation data:', {
    keys: Object.keys(userData).sort(),
    dataCheckString: dataCheckString.substring(0, 200),
    hash: hash.substring(0, 20) + '...',
    hasBotToken: !!botToken,
  });
  
  // Создаем секретный ключ
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  // Создаем хеш
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(dataCheckString);
  const calculatedHash = hmac.digest('hex');
  
  const isValid = calculatedHash === hash;
  
  if (!isValid) {
    console.error('❌ Hash mismatch:', {
      calculated: calculatedHash.substring(0, 20) + '...',
      received: hash.substring(0, 20) + '...',
      dataCheckStringLength: dataCheckString.length,
    });
  } else {
    console.log('✅ Hash matches');
  }
  
  return isValid;
}
