import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { callAsterisk } from '@/pages/api/ariProxy';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bridgeId } = req.query as { bridgeId: string };

  if (!bridgeId) {
    return res.status(400).json({ success: false, error: 'bridgeId is required' });
  }

  try {
    const { channel, role } = (req.body || {}) as { channel?: string; role?: string };

    if (!channel) {
      return res.status(400).json({ success: false, error: 'channel is required' });
    }

    const { data } = await callAsterisk(`/api/ari/bridges/${bridgeId}/add`, {
      method: 'POST',
      body: {
        channel,
        role,
      },
      userId: req.user.userId,
    });

    return res.status(200).json(data ?? { success: true });
  } catch (error) {
    console.error('Add participant error:', error);
    return res.status(502).json({ success: false, error: 'Failed to add participant' });
  }
};

export default withAuth(handler);

