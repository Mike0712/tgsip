import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { listCallsForUser } from '@/lib/calls';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const calls = await listCallsForUser(req.user.userId, { limit, offset });

    return res.status(200).json({
      success: true,
      calls: calls.map((call) => ({
        id: call.id,
        direction: call.direction,
        remote_number: call.remote_number,
        status: call.status,
        started_at: call.started_at,
        answered_at: call.answered_at,
        ended_at: call.ended_at,
        duration_seconds: call.duration_seconds,
      })),
    });
  } catch (error) {
    console.error('[calls/history] Error fetching call history', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);
