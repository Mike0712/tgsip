import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { bridgeStore } from '@/server/bridgeStore';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  switch (req.method) {
    case 'POST': {
      try {
        const { target, metadata } = req.body as {
          target?: string;
          metadata?: Record<string, unknown>;
        };

        const bridge = bridgeStore.createBridge({
          creatorId: req.user.userId,
          target,
          metadata,
          initiatorDisplayName: req.user.username,
        });

        return res.status(201).json({
          success: true,
          bridge,
          participants: bridge.participants,
        });
      } catch (error) {
        console.error('Create bridge error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }

    case 'GET': {
      try {
        const bridges = bridgeStore.listByCreator(req.user.userId);
        return res.status(200).json({ success: true, bridges });
      } catch (error) {
        console.error('List bridge error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }

    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
};

export default withAuth(handler);

