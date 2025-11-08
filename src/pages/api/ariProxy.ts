import { getDb } from '@/lib/db';
import type { Knex } from 'knex';

type CallAsteriskOptions = {
  method?: string;
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>;
  userId?: number;
};

interface ServerRecord {
  id: number;
  ip: string;
  web_port: number;
  url?: string | null;
}

const selectRandomServer = (servers: ServerRecord[]): ServerRecord | null => {
  if (!servers.length) return null;
  const index = Math.floor(Math.random() * servers.length);
  return servers[index];
};

const resolveServerForUser = async (db: Knex, userId: number): Promise<ServerRecord | null> => {
  const record = await db('sip_accounts')
    .select<ServerRecord[]>('servers.id', 'servers.ip', 'servers.web_port', 'servers.url')
    .join('servers', 'sip_accounts.server_id', 'servers.id')
    .where('sip_accounts.user_id', userId)
    .where('sip_accounts.is_active', true)
    .limit(1)
    .first();

  if (!record || !record.ip || !record.web_port) {
    return null;
  }

  return record;
};

const resolveAsteriskBaseUrl = async (userId: number): Promise<string> => {
  const db: Knex = getDb();

  const userServer = await resolveServerForUser(db, userId);
  if (!userServer) {
    throw new Error('Current user has no linked Asterisk server');
  }

  return `http://${userServer.ip}:${userServer.web_port}`;
};

const buildAsteriskUrl = async (path: string, userId: number): Promise<string> => {
  const base = await resolveAsteriskBaseUrl(userId);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export const callAsterisk = async <T = unknown>(
  path: string,
  { method = 'GET', body, headers, userId }: CallAsteriskOptions = {},
): Promise<{ status: number; data: T | null }> => {
  if (!userId) {
    throw new Error('callAsterisk requires userId');
  }

  const url = await buildAsteriskUrl(path, userId);

  const init: RequestInit = {
    method,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  };

  if (body) {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
    };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const errorPayload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text();
    throw new Error(
      typeof errorPayload === 'string'
        ? `Asterisk API error: ${status} ${response.statusText} – ${errorPayload}`
        : `Asterisk API error: ${status} ${response.statusText}`,
    );
  }

  if (status === 204 || !contentType) {
    return { status, data: null };
  }

  if (contentType.includes('application/json')) {
    const data = (await response.json()) as T;
    return { status, data };
  }

  const text = await response.text();
  return { status, data: text as unknown as T };
};


