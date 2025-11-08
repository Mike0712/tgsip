import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { findCallSessionByBridge } from '@/lib/callSessions';
import { getDb } from '@/lib/db';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bridgeId } = req.query as { bridgeId?: string };

  if (!bridgeId) {
    return res.status(400).json({ success: false, error: 'bridgeId is required' });
  }

  try {
    const session = await findCallSessionByBridge(bridgeId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const db = getDb();

    const participants = await db('call_session_participants')
      .where({ session_id: session.id })
      .select(
        'id',
        'session_id',
        'user_id',
        'endpoint',
        'role',
        'status',
        'joined_at',
        'left_at',
        'metadata',
        'created_at',
        'updated_at',
      );

    return res.status(200).json({
      success: true,
      session,
      participants,
    });
  } catch (error) {
    console.error('Fetch call session error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);


