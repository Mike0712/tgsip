import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { userPhoneService } from '../../lib/database';

interface JWTPayload {
  userId: number;
  username?: string;
  telegramId: number;
  iat: number;
  exp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Проверяем JWT токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
    
    // Получаем телефоны пользователя
    const phones = await userPhoneService.findByUserId(decoded.userId);
    
    res.status(200).json({
      success: true,
      phones,
      count: phones.length
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.error('Get user phones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
