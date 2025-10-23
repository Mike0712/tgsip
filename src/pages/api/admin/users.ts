// src/pages/api/admin/users.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { userService } from '../../../lib/database';
import { authenticateSession } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем аутентификацию
  const user = await authenticateSession(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Добавить проверку роли администратора
  // Пока разрешаем всем аутентифицированным пользователям

  try {
    switch (req.method) {
      case 'GET':
        // Получить всех пользователей (для админки)
        const users = await userService.findAll();
        res.status(200).json({
          success: true,
          users: users.map(user => ({
            id: user.id,
            telegram_id: user.telegram_id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            last_seen: user.last_seen,
            created_at: user.created_at
          }))
        });
        break;

      case 'POST':
        // Добавить нового пользователя
        const { telegram_id, username, first_name, last_name } = req.body;
        
        if (!telegram_id || !first_name) {
          return res.status(400).json({ error: 'telegram_id and first_name are required' });
        }

        // Проверяем не существует ли уже пользователь
        const existingUser = await userService.findByTelegramId(telegram_id.toString());
        if (existingUser) {
          return res.status(409).json({ error: 'User already exists' });
        }

        const newUser = await userService.create({
          telegram_id: telegram_id.toString(),
          username,
          first_name,
          last_name
        });

        res.status(201).json({
          success: true,
          user: {
            id: newUser.id,
            telegram_id: newUser.telegram_id,
            username: newUser.username,
            first_name: newUser.first_name,
            last_name: newUser.last_name
          }
        });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
