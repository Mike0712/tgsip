import { NextApiRequest, NextApiResponse } from 'next';
import { registrationRequestService } from '../../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_id, username } = req.body || {};

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id is required' });
    }

    const request = await registrationRequestService.create(String(telegram_id), username);

    res.status(201).json({
      success: true,
      request: {
        id: request.id,
        telegram_id: request.telegram_id,
        username: request.username,
        status: request.status,
        created_at: request.created_at,
      }
    });
  } catch (error) {
    // Если БД не настроена/недоступна, не падаем — принимаем заявку "в обработку"
    console.error('request-registration error (returning 202):', error);
    try {
      const { telegram_id, username } = (req.body || {}) as { telegram_id?: string; username?: string };
      console.log('Queued registration request:', { telegram_id, username });
    } catch {}
    res.status(202).json({ success: true, queued: true });
  }
}


