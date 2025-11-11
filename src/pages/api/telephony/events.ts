import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { findCallSessionByBridge, updateCallSessionStatus, upsertCallSessionParticipant } from '@/lib/callSessions';

interface TelephonyEventPayload {
  event?: string;
  bridge_id?: string;
  uniqueid?: string;
  caller?: string;
  endpoint?: string;
  status?: 'pending' | 'dialing' | 'joined' | 'failed' | 'left';
  metadata?: Record<string, unknown>;
}

const eventsHandler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const payload = (req.body || {}) as TelephonyEventPayload;
  const { event, bridge_id: bridgeId } = payload;

  if (!event || !bridgeId) {
    return res.status(400).json({ success: false, error: 'event and bridge_id are required' });
  }

  try {
    const session = await findCallSessionByBridge(bridgeId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    switch (event) {
      case 'bridge_join':
      case 'participant_joined': {
        await upsertCallSessionParticipant({
          sessionId: session.id,
          endpoint: payload.endpoint || payload.caller || payload.uniqueid || 'unknown',
          status: payload.status || 'joined',
          metadata: payload.metadata,
        });
        await updateCallSessionStatus(session.id, 'active');
        break;
      }

      case 'participant_left':
      case 'bridge_left': {
        await upsertCallSessionParticipant({
          sessionId: session.id,
          endpoint: payload.endpoint || payload.caller || payload.uniqueid || 'unknown',
          status: 'left',
          metadata: payload.metadata,
        });
        break;
      }

      case 'bridge_completed': {
        await updateCallSessionStatus(session.id, 'completed');
        break;
      }

      case 'bridge_failed': {
        await updateCallSessionStatus(session.id, 'failed');
        break;
      }

      default:
        console.log('[telephony/events] Unhandled event', event, payload);
        break;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[telephony/events] Error handling event', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(eventsHandler);
