import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userIds } = req.body as { userIds?: number[] };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'userIds array is required' });
    }

    const db = getDb();
    const users = await db('users')
      .select('id', 'telegram_id', 'username', 'first_name', 'last_name', 'photo_url')
      .whereIn('id', userIds);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Batch get users error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);

