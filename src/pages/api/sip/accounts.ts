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

  const db = getDb();

  try {
    switch (req.method) {
      case 'GET':
        // Получить SIP аккаунты пользователя из БД с JOIN к таблице servers
        const sipAccounts = await db('sip_accounts')
          .select(
            'sip_accounts.id',
            'sip_accounts.sip_username',
            'sip_accounts.sip_password',
            'sip_accounts.is_active',
            'sip_accounts.settings',
            'servers.url as sip_server',
            'servers.ip as sip_ip',
            'servers.port as sip_port'
          )
          .join('servers', 'sip_accounts.server_id', 'servers.id')
          .where('sip_accounts.user_id', user.userId);

        console.log('📞 SIP accounts for user', user.userId, ':', sipAccounts, user);

        res.status(200).json({
          success: true,
          accounts: sipAccounts.map((account: any) => ({
            id: account.id,
            sip_username: account.sip_username,
            sip_server: account.sip_server,
            sip_ip: account.sip_ip,
            sip_port: parseInt(account.sip_port),
            secret: account.sip_password,
            is_active: account.is_active,
            settings: account.settings
          }))
        });
        break;

      case 'POST':
        // Создать новый SIP аккаунт
        const { sip_username, sip_password, server_id, settings } = req.body;
        
        if (!sip_username || !sip_password || !server_id) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
          const [newAccount] = await db('sip_accounts')
            .insert({
              user_id: user.userId,
              sip_username,
              sip_password,
              server_id,
              is_active: true,
              settings: settings ? JSON.stringify(settings) : null
            })
            .returning('*');

          // Получаем информацию о сервере
          const server = await db('servers')
            .select('*')
            .where('id', newAccount.server_id)
            .first();

          res.status(201).json({
            success: true,
            account: {
              id: newAccount.id,
              sip_username: newAccount.sip_username,
              sip_server: server.url,
              sip_ip: server.ip,
              sip_port: parseInt(server.port),
              secret: newAccount.sip_password,
              is_active: newAccount.is_active,
              settings: newAccount.settings
            }
          });
        } catch (error: any) {
          if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'SIP account already exists' });
          }
          throw error;
        }
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('SIP accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
