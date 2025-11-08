import crypto from 'crypto';
import { getDb } from '@/lib/db';

interface CreateSessionParams {
  bridgeId: string;
  serverId: number;
  creatorUserId?: number | null;
  target?: string;
  metadata?: Record<string, unknown>;
  status?: 'pending' | 'active' | 'completed' | 'failed' | 'terminated';
}

const generateHash = (): string => crypto.randomBytes(16).toString('hex');

export const createCallSession = async ({
  bridgeId,
  serverId,
  creatorUserId = null,
  target,
  metadata,
  status = 'pending',
}: CreateSessionParams) => {
  const db = getDb();
  const linkHash = generateHash();

  const [session] = await db('call_sessions')
    .insert({
      bridge_id: bridgeId,
      link_hash: linkHash,
      status,
      server_id: serverId,
      creator_user_id: creatorUserId ?? null,
      metadata: metadata ? JSON.stringify({ target, ...metadata }) : JSON.stringify({ target }),
    })
    .returning('*');

  return session;
};

export const findCallSessionByBridge = async (bridgeId: string) => {
  const db = getDb();
  const session = await db('call_sessions')
    .where({ bridge_id: bridgeId })
    .first();
  return session || null;
};

