import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { bridgeStore } from '@/server/bridgeStore';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  const { bridgeId } = req.query as { bridgeId: string };

  try {
    const bridge = bridgeStore.getBridge(bridgeId);

    if (!bridge || bridge.creator_id !== req.user.userId) {
      return res.status(404).json({ success: false, error: 'Bridge not found' });
    }

    switch (req.method) {
      case 'GET': {
        return res.status(200).json({
          success: true,
          bridge,
          participants: bridge.participants,
        });
      }

      case 'DELETE': {
        const terminated = bridgeStore.terminateBridge(bridgeId);
        return res.status(200).json({
          success: true,
          bridge: terminated,
        });
      }

      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Bridge handler error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);

