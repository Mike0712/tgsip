import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { bridgeStore } from '@/server/bridgeStore';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bridgeId } = req.query as { bridgeId: string };

  try {
    const bridge = bridgeStore.getBridge(bridgeId);

    if (!bridge || bridge.creator_id !== req.user.userId) {
      return res.status(404).json({ success: false, error: 'Bridge not found' });
    }

    const { type, role, reference, display_name, metadata } = req.body as {
      type: 'user' | 'sip' | 'phone' | 'external';
      role: 'initiator' | 'participant';
      reference: string;
      display_name?: string;
      metadata?: Record<string, unknown>;
    };

    if (!type || !role || !reference) {
      return res.status(400).json({ success: false, error: 'type, role and reference are required' });
    }

    const participants = bridgeStore.addParticipant(bridgeId, {
      type,
      role,
      reference,
      display_name,
      metadata,
    });

    return res.status(200).json({ success: true, participants });
  } catch (error) {
    console.error('Add participant error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);

