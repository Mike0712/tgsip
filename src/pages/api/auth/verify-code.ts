import { NextApiRequest, NextApiResponse } from 'next';
import { userService, loginCodeService, sessionService } from '../../../lib/database';
import { createToken } from '../../../lib/auth';
import logger from '../logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { user_id, code } = req.body || {};
    if (!user_id || typeof user_id !== 'number') {
      return res.status(400).json({ success: false, error: 'user_id (number) is required' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'code (string) is required' });
    }

    const user = await userService.findById(user_id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const loginCode = await loginCodeService.findValid(user_id, code);
    if (!loginCode) {
      return res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }

    await loginCodeService.markUsed(loginCode.id);

    const token = createToken({
      userId: user.id,
      username: user.username,
      telegramId: Number(user.telegram_id),
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    await sessionService.create(user.id, token, expiresAt, deviceInfo, ipAddress);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    logger.error({ error }, '[auth/verify-code] Unexpected error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
