import { getDb } from '@/lib/db';

export type CallStatus = 'ringing' | 'answered' | 'missed' | 'failed';
export type CallDirection = 'incoming' | 'outgoing';

export interface Call {
  id: number;
  user_id: number;
  direction: CallDirection;
  bridge_id: string;
  from_number: string;
  sip_user: string | null;
  status: CallStatus;
  started_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface CreateCallParams {
  userId: number;
  bridgeId: string;
  fromNumber: string;
  sipUser?: string | null;
  direction?: CallDirection;
  metadata?: Record<string, unknown>;
}

export const createCall = async ({
  userId,
  bridgeId,
  fromNumber,
  sipUser,
  direction = 'incoming',
  metadata,
}: CreateCallParams): Promise<Call> => {
  const db = getDb();
  const [call] = await db('calls')
    .insert({
      user_id: userId,
      direction,
      bridge_id: bridgeId,
      from_number: fromNumber,
      sip_user: sipUser ?? null,
      status: 'ringing',
      started_at: db.fn.now(),
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning('*');
  return call;
};

export const findCallByBridgeId = async (bridgeId: string): Promise<Call | null> => {
  const db = getDb();
  const call = await db('calls').where({ bridge_id: bridgeId }).first();
  return call || null;
};

export const markCallAnswered = async (id: number): Promise<Call> => {
  const db = getDb();
  const [call] = await db('calls')
    .where({ id })
    .update({
      status: 'answered',
      answered_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  return call;
};

export const markCallEnded = async (id: number): Promise<Call> => {
  const db = getDb();
  const existing = await db('calls').where({ id }).first();
  if (!existing) {
    throw new Error(`Call ${id} not found`);
  }

  const endedAt = new Date();
  const status: CallStatus = existing.status === 'ringing' ? 'missed' : existing.status;
  const durationSeconds = existing.answered_at
    ? Math.max(0, Math.round((endedAt.getTime() - new Date(existing.answered_at).getTime()) / 1000))
    : null;

  const [call] = await db('calls')
    .where({ id })
    .update({
      status,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      updated_at: db.fn.now(),
    })
    .returning('*');
  return call;
};

interface ListCallsOptions {
  limit?: number;
  offset?: number;
}

export const listCallsForUser = async (
  userId: number,
  { limit = 30, offset = 0 }: ListCallsOptions = {},
): Promise<Call[]> => {
  const db = getDb();
  return db('calls')
    .where({ user_id: userId })
    .orderBy('started_at', 'desc')
    .limit(limit)
    .offset(offset);
};
