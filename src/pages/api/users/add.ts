import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/db';

interface JWTPayload {
  userId: number;
  username?: string;
  telegramId: number;
}

// Middleware для проверки аутентификации
function authenticateToken(req: NextApiRequest): JWTPayload | null {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = authenticateToken(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getDb();

  try {
    // Получаем все доступные серверы с web_port
    const servers = await db('servers')
      .select('id', 'ip', 'web_port')
      .whereNotNull('web_port')
      .where('web_port', '>', 0);

    if (servers.length === 0) {
      return res.status(503).json({ 
        error: 'No servers available',
        success: false 
      });
    }

    // Выбираем случайный сервер
    const randomServer = servers[Math.floor(Math.random() * servers.length)];
    const apiUrl = `http://${randomServer.ip}:${randomServer.web_port}/api/add`;

    console.log(`📞 Adding user ${user.telegramId} via server ${randomServer.ip}:${randomServer.web_port}`);

    // Вызываем внешний API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telegram_id: String(user.telegramId) }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ External API error:', errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error || `Failed to add user to Asterisk (${response.status})`,
      });
    }

    const data = await response.json();
    
    console.log('✅ User added successfully:', data);

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('❌ Error adding user:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

