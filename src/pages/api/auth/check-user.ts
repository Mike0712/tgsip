import { NextApiRequest, NextApiResponse } from 'next';
import { userService } from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    // Проверяем существует ли пользователь в базе данных
    const user = await userService.findByTelegramId(telegramId.toString());
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: 'Пользователь не найден в системе. Обратитесь к администратору для получения доступа.'
      });
    }

    res.status(200).json({
      success: true,
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
    console.error('Check user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
