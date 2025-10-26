import type { NextApiRequest, NextApiResponse } from 'next';
import { telephonyService } from '@/lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { did } = req.query;

    if (!did || typeof did !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'DID is required' 
      });
    }

    // Ищем пользователя по номеру телефона (DID)
    const userData = await telephonyService.findUserByDID(did);

    if (!userData) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: `No user found for DID: ${did}`
      });
    }

    res.status(200).json({
      success: true,
      user: userData.sip_username,
      user_id: userData.user_id
    });

  } catch (error) {
    console.error('Incoming route error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}