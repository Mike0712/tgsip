import { NextApiRequest, NextApiResponse } from 'next';
import { userService } from '../../../lib/database';
import { authenticateSession } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем аутентификацию
  const user = await authenticateSession(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

        // Проверяем не существует ли уже пользователь (включая удаленных)
        const existingUser = await userService.findByTelegramId(telegram_id.toString(), true);
        if (existingUser && !existingUser.deleted_at) {
          return res.status(409).json({ error: 'User already exists' });
        }
        // Если пользователь был удален, восстанавливаем его
        if (existingUser && existingUser.deleted_at) {
          const restoredUser = await userService.restore(existingUser.id);
          return res.status(200).json({
            success: true,
            user: {
              id: restoredUser.id,
              telegram_id: restoredUser.telegram_id,
              username: restoredUser.username,
              first_name: restoredUser.first_name,
              last_name: restoredUser.last_name
            },
            restored: true
          });
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
