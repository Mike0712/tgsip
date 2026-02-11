import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { sessionService } from '@/lib/database';

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
    
    // Проверяем сессию в базе данных
    const session = await sessionService.findByToken(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session not found or expired',
        expired: true
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: decoded.userId,
        telegramId: decoded.telegramId,
        username: decoded.username
      }
    });

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Деактивируем сессию в базе данных при истечении токена
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          await sessionService.deactivate(token);
        } catch (deactivateError) {
          console.error('Failed to deactivate expired session:', deactivateError);
        }
      }
      
      return res.status(401).json({ 
        success: false,
        error: 'Token expired',
        expired: true 
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token' 
      });
    }
    
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}
