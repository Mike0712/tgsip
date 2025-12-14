import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { AsteriskApiError, callAsterisk } from '@/pages/api/ariProxy';
import logger from '../../../logger';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  const { bridgeId } = req.query as { bridgeId: string };

  if (!bridgeId) {
    return res.status(400).json({ success: false, error: 'bridgeId is required' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const { data } = await callAsterisk(`/api/ari/bridges/${bridgeId}`, { userId: req.user.userId });
        return res.status(200).json(data ?? { success: true });
      }

      case 'DELETE': {
        await callAsterisk(`/api/ari/bridges/${bridgeId}`, { method: 'DELETE', userId: req.user.userId });
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error(error as AsteriskApiError, `[/api/ari/bridges/${bridgeId}] Error`);
    const status = (error as AsteriskApiError)?.status || 502;
    if (status === 404) {
      return res.status(404).json({ success: false, error: 'Сессия не найдена' });
    }
    return res.status(status).json({ success: false, error: 'Failed to communicate with Asterisk API' });
  }
};

export default withAuth(handler);

