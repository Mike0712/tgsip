import type { NextApiResponse } from 'next';
import { userService } from '@/lib/database';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';

const handler = async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { q, limit } = req.query;
    const query = typeof q === 'string' ? q.trim() : '';

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }

    const numericLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined;
    const users = await userService.search(query, numericLimit);

    return res.status(200).json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: user.photo_url,
      })),
    });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export default withAuth(handler);

