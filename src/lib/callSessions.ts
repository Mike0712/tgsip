import crypto from 'crypto';
import { getDb } from '@/lib/db';
import type { Knex } from 'knex';

interface CreateSessionParams {
  bridgeId: string;
  serverId: number;
  creatorUserId?: number | null;
  target?: string;
  metadata?: Record<string, unknown>;
  status?: 'pending' | 'active' | 'completed' | 'failed' | 'terminated';
}

const generateHash = (): string => crypto.randomBytes(16).toString('hex');
const generateExtension = (): string => `010${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;

const getUniqueExtension = async (db: Knex): Promise<string> => {
  let extension = generateExtension();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db('call_sessions').where({ join_extension: extension }).first();
    if (!existing) {
      return extension;
    }
    extension = generateExtension();
  }
};

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
  const joinExtension = metadata?.join_extension
    ? String(metadata.join_extension)
    : await getUniqueExtension(db);

  const metadataPayload = {
    ...(metadata || {}),
    target,
    join_extension: joinExtension,
  };

  const [session] = await db('call_sessions')
    .insert({
      bridge_id: bridgeId,
      link_hash: linkHash,
      status,
      server_id: serverId,
      creator_user_id: creatorUserId ?? null,
      join_extension: joinExtension,
      metadata: JSON.stringify(metadataPayload),
    })
    .returning('*');

  return session;
};

export const findCallSessionByBridge = async (bridgeId: string) => {
  const db = getDb();
  const session = await db('call_sessions').where({ bridge_id: bridgeId }).first();
  return session || null;
};

export const findCallSessionByExtension = async (extension: string) => {
  const db = getDb();
  const session = await db('call_sessions').where({ join_extension: extension }).first();
  return session || null;
};

export const updateCallSessionStatus = async (
  sessionId: number,
  status: 'pending' | 'active' | 'completed' | 'failed' | 'terminated',
) => {
  const db = getDb();
  const [updated] = await db('call_sessions')
    .where({ id: sessionId })
    .update({
      status,
      updated_at: db.fn.now(),
    })
    .returning('*');
  return updated;
};

interface UpsertParticipantParams {
  sessionId: number;
  userId?: number | null;
  endpoint: string;
  role?: 'initiator' | 'participant';
  status?: 'pending' | 'dialing' | 'joined' | 'failed' | 'left';
  metadata?: Record<string, unknown>;
}

export const upsertCallSessionParticipant = async ({
  sessionId,
  userId = null,
  endpoint,
  role = 'participant',
  status = 'pending',
  metadata,
}: UpsertParticipantParams) => {
  const db = getDb();

  const existing = userId
    ? await db('call_session_participants')
        .where({ session_id: sessionId, user_id: userId })
        .first()
    : null;

  const timestamps: Record<string, unknown> = {
    updated_at: db.fn.now(),
  };

  if (status === 'joined') {
    timestamps.joined_at = db.fn.now();
  } else if (status === 'left') {
    timestamps.left_at = db.fn.now();
  }

  if (existing) {
    const [updated] = await db('call_session_participants')
      .where({ id: existing.id })
      .update({
        endpoint,
        role,
        status,
        metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
        ...timestamps,
      })
      .returning('*');
    return updated;
  }

  const [participant] = await db('call_session_participants')
    .insert({
      session_id: sessionId,
      user_id: userId,
      endpoint,
      role,
      status,
      metadata: metadata ? JSON.stringify(metadata) : null,
      joined_at: status === 'joined' ? db.fn.now() : null,
      left_at: null,
    })
    .returning('*');

  return participant;
};

