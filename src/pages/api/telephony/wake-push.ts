import type { NextApiRequest, NextApiResponse } from 'next';
import { pushTokenService } from '@/lib/database';
import { isFirebaseConfigured, sendIncomingCallPush } from '@/lib/firebaseAdmin';
import logger from '../logger';

// Дёргается из Asterisk dialplan (offline-ветка), параллельно с /telephony/notify —
// будит мобильное приложение из killed-состояния FCM data-push'ем, пока
// диалплан крутит звонящему гудки и ждёт, пока приложение зарегистрируется по SIP.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { user_id, from } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    if (!isFirebaseConfigured()) {
      logger.error('[telephony/wake-push] FIREBASE_SERVICE_ACCOUNT not configured');
      return res.status(500).json({ success: false, error: 'Firebase not configured' });
    }

    const token = await pushTokenService.findByUserId(parseInt(user_id, 10));
    if (!token) {
      return res.status(404).json({ success: false, error: 'No push token registered for user' });
    }

    const callerNumber = typeof from === 'string' ? from : 'Unknown';
    const result = await sendIncomingCallPush(token.fcm_token, { from: callerNumber });

    if (!result.ok) {
      logger.error({ error: result.error }, '[telephony/wake-push] Failed to send push');
      return res.status(502).json({ success: false, error: result.error });
    }

    logger.info(`[telephony/wake-push] Push sent to user ${user_id} for call from ${callerNumber}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, '[telephony/wake-push] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
