import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { createCall } from '@/lib/calls';

// Reported directly by the mobile client (sip.js Inviter session state) —
// outgoing calls never touch asterserver's ARI/Stasis pipeline (see
// telephony/events.ts for the incoming counterpart, which does).
const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { to_number: toNumber } = (req.body || {}) as { to_number?: string };
    if (!toNumber || typeof toNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'to_number is required' });
    }

    const call = await createCall({
      userId: req.user.userId,
      remoteNumber: toNumber,
      direction: 'outgoing',
    });

    return res.status(201).json({ success: true, call: { id: call.id } });
  } catch (error) {
    console.error('[calls/outgoing] Error creating outgoing call', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);
