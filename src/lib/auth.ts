import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { sessionService } from './database';
import crypto from 'crypto';

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

export function validateTelegramData(
  initData: string,
  botToken: string,
  maxAgeSec = 24 * 60 * 60
): boolean {
  if (!initData) return false;

  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) return false;

  params.delete("hash");

  const authDateStr = params.get("auth_date");
  if (!authDateStr) return false;

  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > maxAgeSec) return false;

  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys
    .map((k) => `${k}=${params.get(k) ?? ""}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest("base64");

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // constant-time compare
  try {
    return crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(computedHash, "hex")),
      new Uint8Array(Buffer.from(hash, "hex"))
    );
  } catch {
    return false;
  }
}
