import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import {
  findCallSessionByBridge,
  findCallSessionByExtension,
  updateCallSessionStatus,
  upsertCallSessionParticipant,
} from '@/lib/callSessions';

interface TelephonyEventPayload {
  event?: string;
  bridge_id?: string;
  uniqueid?: string;
  caller?: string;
  endpoint?: string;
  status?: 'pending' | 'dialing' | 'joined' | 'failed' | 'left';
  metadata?: Record<string, unknown>;
}

const allowedIps = (process.env.ALLOWED_TELEPHONY_IPS ?? '').split(',').map(ip => ip.trim()).filter(Boolean);

const ipAuthWrapper = (handler: any) => async (req: any, res: any) => {
  const realIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (!allowedIps.includes(realIp)) {
    return res.status(401).json({ error: 'Unauthorized (ip)' });
  }
  return handler(req, res);
};

const extractPayload = (body: any): TelephonyEventPayload | null => {
  if (!body) return null;

  const parseJson = (value: string) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('[telephony/events] Failed to parse JSON payload', error, value);
      return null;
    }
  };

  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{')) {
      return parseJson(trimmed);
    }

    // Handle forms like channel_info=...
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      const joined = rest.join('=');
      const decoded = decodeURIComponent(joined);
      if (key === 'channel_info' || key === 'payload') {
        return parseJson(decoded);
      }

      if (decoded.startsWith('{')) {
        return parseJson(decoded);
      }
    }

    return null;
  }

  if (typeof body === 'object') {
    if ('event' in body) {
      return body as TelephonyEventPayload;
    }

    if (typeof body.channel_info === 'string') {
      return parseJson(body.channel_info);
    }

    if (typeof body.payload === 'string') {
      return parseJson(body.payload);
    }
  }

  return null;
};

const eventsHandler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const payload = extractPayload(req.body);

  if (!payload) {
    return res.status(400).json({ success: false, error: 'Invalid payload' });
  }

  const { event } = payload;

  if (!event) {
    return res.status(400).json({ success: false, error: 'event is required' });
  }

  let bridgeId = payload.bridge_id;
  let session = null;

  try {
    if (bridgeId) {
      session = await findCallSessionByBridge(bridgeId);
    }

    if (!session) {
      const extensionCandidates = [
        payload.endpoint,
        payload.caller,
        payload.metadata?.join_extension,
        payload.metadata?.endpoint,
      ]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());

      for (const candidate of extensionCandidates) {
        let found = await findCallSessionByExtension(candidate);

        if (!found && /\D/.test(candidate)) {
          const numericExt = candidate.replace(/\D+/g, '');
          if (numericExt) {
            found = await findCallSessionByExtension(numericExt);
          }
        }

        if (found) {
          session = found;
          bridgeId = found.bridge_id;
          break;
        }
      }
    }

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

export default ipAuthWrapper(eventsHandler);
