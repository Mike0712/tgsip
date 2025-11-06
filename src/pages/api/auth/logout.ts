import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { sessionService } from '../../../lib/database';

interface JWTPayload {
  userId: number;
  username?: string;
  telegramId: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Проверяем токен и получаем payload
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
    } catch (error) {
      // Токен недействителен, но все равно возвращаем успех
      console.log('Invalid token during logout:', error);
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }

    // Деактивируем сессию в базе данных
    try {
      await sessionService.deactivate(token);
      console.log('✅ Session deactivated for user:', payload.userId);
    } catch (error) {
      console.error('Failed to deactivate session:', error);
      // Продолжаем выполнение даже если не удалось деактивировать сессию
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
