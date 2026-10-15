import type { NextApiResponse } from 'next';
import { pushTokenService } from '@/lib/database';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import logger from '../logger';

// Вызывается мобильным приложением (mobile/) при старте и при обновлении
// FCM-токена, после логина через Telegram deep-link (api/telegram/webhook) —
// user_id берём из JWT (withAuth), не из тела запроса.
const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { token } = req.body ?? {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token (string) is required' });
    }

    await pushTokenService.upsert(req.user.userId, token, 'android');

    logger.info(`[telephony/register-push-token] Token registered for user ${req.user.userId}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, '[telephony/register-push-token] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);
