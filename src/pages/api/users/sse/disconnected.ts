import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/db';
import { callAsterisk } from '@/pages/api/ariProxy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  try {
    const db = getDb();
    const userId = parseInt(user_id);

    // Находим все незавершенные участники для этого пользователя с metadata
    const activeParticipants = await db('call_session_participants')
      .where({ user_id: userId })
      .where('status', '!=', 'left')
      .select('id', 'session_id', 'metadata');

    if (activeParticipants.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No active participants found',
        updated: 0,
        channels_terminated: 0
      });
    }

    // Собираем channel_id из metadata
    const channelIds: string[] = [];
    for (const participant of activeParticipants) {
      if (participant.metadata) {
        try {
          const metadata = typeof participant.metadata === 'string' 
            ? JSON.parse(participant.metadata) 
            : participant.metadata;
          
          if (metadata.channel_id && typeof metadata.channel_id === 'string') {
            channelIds.push(metadata.channel_id);
          }
        } catch (error) {
          console.warn(`[SSE Disconnect] Failed to parse metadata for participant ${participant.id}:`, error);
        }
      }
    }

    // Завершаем каналы через ARI API (игнорируем ошибки - это просто очистка мусора)
    let channelsTerminated = 0;
    for (const channelId of channelIds) {
      try {
        await callAsterisk(`/api/ari/channels/${channelId}`, {
          method: 'DELETE',
          userId: userId,
        });
        channelsTerminated++;
        console.log(`[SSE Disconnect] Terminated channel ${channelId} for user_id=${user_id}`);
      } catch (error) {
        // Игнорируем ошибки (502 если канал не существует - это нормально)
        console.log(`[SSE Disconnect] Channel ${channelId} already terminated or not found`);
      }
    }

    // Завершаем всех участников
    let updated = 0;
    try {
      updated = await db('call_session_participants')
        .where({ user_id: userId })
        .where('status', '!=', 'left')
        .update({
          status: 'left',
          left_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
    } catch (error) {
      console.log(`[SSE Disconnect] Error updating participants (non-critical):`, error);
    }

    console.log(`[SSE Disconnect] Cleaned up ${updated} participants and ${channelsTerminated} channels for user_id=${user_id}`);

    return res.status(200).json({ 
      success: true, 
      updated,
      channels_terminated: channelsTerminated
    });
  } catch (error) {
    // Всегда возвращаем 200 - это просто очистка мусора
    console.log('[SSE Disconnect] Cleanup completed with some errors (non-critical):', error);
    return res.status(200).json({ 
      success: true,
      updated: 0,
      channels_terminated: 0
    });
  }
};