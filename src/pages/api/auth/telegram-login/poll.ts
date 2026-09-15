import { NextApiRequest, NextApiResponse } from 'next';
import { telegramLoginService } from '@/lib/database';
import logger from '../../logger';

// Step 3: the mobile app polls this with the token from start.ts while the
// user confirms in Telegram. The webhook (api/telegram/webhook.ts) is what
// actually flips the row to 'confirmed'/'not_found' once Telegram calls us.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'token is required' });
  }

  try {
    const request = await telegramLoginService.findByToken(token);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Unknown token' });
    }

    if (request.status === 'pending' && request.expires_at.getTime() < Date.now()) {
      return res.status(200).json({ success: true, status: 'expired' });
    }

    if (request.status === 'confirmed') {
      return res.status(200).json({ success: true, status: 'confirmed', token: request.jwt_token });
    }

    return res.status(200).json({ success: true, status: request.status });
  } catch (error) {
    logger.error({ error }, '[auth/telegram-login/poll] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
