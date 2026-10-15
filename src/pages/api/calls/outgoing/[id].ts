import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { findCallById, markCallAnswered, markCallEnded } from '@/lib/calls';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const id = Number(req.query.id);
    const { event } = (req.body || {}) as { event?: 'answered' | 'ended' };

    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'Invalid call id' });
    }
    if (event !== 'answered' && event !== 'ended') {
      return res.status(400).json({ success: false, error: "event must be 'answered' or 'ended'" });
    }

    const existing = await findCallById(id);
    if (!existing || existing.user_id !== req.user.userId) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    const call = event === 'answered' ? await markCallAnswered(id) : await markCallEnded(id);

    return res.status(200).json({ success: true, call: { id: call.id, status: call.status } });
  } catch (error) {
    console.error('[calls/outgoing/[id]] Error updating outgoing call', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);
