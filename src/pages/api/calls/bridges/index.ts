import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { callAsterisk } from '@/pages/api/ariProxy';
import { createCallSession, findCallSessionByBridge } from '@/lib/callSessions';
import { getDb } from '@/lib/db';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  switch (req.method) {
    case 'POST': {
      try {
        const { target, metadata } = (req.body || {}) as {
          target?: string;
          metadata?: Record<string, unknown>;
        };

        const payload = {
          target,
          metadata: {
            ...(metadata || {}),
            creator: {
              id: req.user.userId,
              username: req.user.username,
            },
          },
        };

        const db = getDb();
        const sipAccount = await db('sip_accounts')
          .select('server_id')
          .where({ user_id: req.user.userId, is_active: true })
          .orderBy('updated_at', 'desc')
          .first();

        if (!sipAccount) {
          return res.status(400).json({
            success: false,
            error: 'Нет активного SIP аккаунта для текущего пользователя',
          });
        }

        const { data } = await callAsterisk<{ bridge?: { id: string }; participants?: unknown[] } & Record<string, unknown>>(
          '/api/ari/bridges',
          {
            method: 'POST',
            body: payload,
            userId: req.user.userId,
          },
        );

        const bridge = data?.bridge;

        if (!bridge?.id) {
          return res.status(502).json({
            success: false,
            error: 'Asterisk не вернул идентификатор моста',
          });
        }

        let session = await findCallSessionByBridge(bridge.id);

        if (!session) {
          session = await createCallSession({
            bridgeId: bridge.id,
            serverId: sipAccount.server_id,
            creatorUserId: req.user.userId,
            target,
            metadata,
            status: 'pending',
          });
        }

        return res.status(201).json({
          success: true,
          bridge: {
            ...bridge,
            join_extension: session?.join_extension || null,
          },
          session,
        });
      } catch (error) {
        console.error('Create bridge error:', error);
        return res.status(502).json({ success: false, error: 'Failed to create bridge' });
      }
    }

    case 'GET': {
      // ARI proxy не хранит список мостов — возвращаем пустой список, чтобы не ломать потребителей.
      return res.status(200).json({ success: true, bridges: [] });
    }

    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
};

export default withAuth(handler);

