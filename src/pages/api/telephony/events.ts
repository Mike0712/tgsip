import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import {
  findCallSessionByBridge,
  findCallSessionByExtension,
  updateCallSessionStatus,
  upsertCallSessionParticipant,
} from '@/lib/callSessions';
import { getDb } from '@/lib/db';
import type { Knex } from 'knex';
import { sipAccountService } from '@/lib/database';
import { sseClient } from '../../api/sseClient';
import logger from '../logger';

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
  if (allowedIps.includes('*')) {
    return handler(req, res);
  }
  
  const realIp = req.headers['x-forwarded-for']?.split(',')[0].trim().replace(/^::ffff:/i, '') || req.socket.remoteAddress;
  if (!allowedIps.includes(realIp)) {
    return res.status(401).json({ error: `Unauthorized (ip) - ${realIp}` });
  }
  return handler(req, res);
};

const eventsHandler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const payload = req.body;

  if (!payload) {
    return res.status(400).json({ success: false, error: 'Invalid payload' });
  }

  const { event } = payload;

  if (!event) {
    return res.status(400).json({ success: false, error: 'event is required' });
  }

  let bridgeId = payload.bridge_id;
  let session: any = null;

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
        logger.info({event, payload}, '[telephony/events] Entering bridge_join/participant_joined case');
        try {
          const userAccount = await sipAccountService.findBySipUsername(payload.caller);
          const participant = await upsertCallSessionParticipant({
            sessionId: session.id,
            userId: userAccount?.user_id,
            endpoint: payload.endpoint || payload.caller || payload.uniqueid || 'unknown',
            status: payload.status || 'joined',
            metadata: payload.metadata,
          });
          await updateCallSessionStatus(session.id, 'active');
          await sseClient(`/pushEvent`, {
            method: 'POST',
            body: JSON.stringify({
              event: 'participant_joined',
              event_id: session.bridge_id,
              payload: {
                participant
              },
            }),
          });
        } catch (error) {
          logger.error({error}, '[telephony/events] Error pushing event');
        }
        break;
      }

      case 'participant_left':
      case 'bridge_left': {
        const userAccount = await sipAccountService.findBySipUsername(payload.caller);
        if (!userAccount) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        await upsertCallSessionParticipant({
          sessionId: session.id,
          userId: userAccount?.user_id,
          endpoint: payload.endpoint || payload.caller || payload.uniqueid || 'unknown',
          status: 'left',
          metadata: payload.metadata,
        });

        await sseClient(`/pushEvent`, {
          method: 'POST',
          body: JSON.stringify({
            event: 'participant_left',
            event_id: session.bridge_id,
            payload: {
              userId: userAccount?.user_id,
            },
          }),
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

      case 'bridge_created': {
        // Мост создан - можно обновить статус сессии на 'active' если она еще не активна
        if (session.status !== 'active') {
          await updateCallSessionStatus(session.id, 'active');
        }
        break;
      }

      case 'channel_destroyed':
      case 'channel_hangup_request':
      case 'stasis_end': {
        // Канал уничтожен/завершен/покинул Stasis - обновляем статус участника
        const endpoint = payload.endpoint || payload.caller || payload.uniqueid;
        if (endpoint) {
          const userAccount = await sipAccountService.findBySipUsername(payload.caller || endpoint);
          await upsertCallSessionParticipant({
            sessionId: session.id,
            userId: userAccount?.user_id,
            endpoint: endpoint,
            status: 'left',
            metadata: {
              ...payload.metadata,
              cause: payload.metadata?.cause,
              cause_txt: payload.metadata?.cause_txt,
            },
          });
        }
        break;
      }

      case 'channel_state_change': {
        // Изменение состояния канала - обновляем статус участника если канал стал активным
        const endpoint = payload.endpoint || payload.caller || payload.uniqueid;
        const channelState = payload.metadata?.channel_state as string;
        
        if (endpoint && channelState === 'Up') {
          const userAccount = await sipAccountService.findBySipUsername(payload.caller || endpoint);
          const participant = await upsertCallSessionParticipant({
            sessionId: session.id,
            userId: userAccount?.user_id,
            endpoint: endpoint,
            status: 'joined',
            metadata: payload.metadata,
          });
          
          await updateCallSessionStatus(session.id, 'active');
          
          await sseClient(`/pushEvent`, {
            method: 'POST',
            body: JSON.stringify({
              event: 'participant_joined',
              event_id: session.id,
              payload: {
                participant
              },
            }),
          });
        }
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
