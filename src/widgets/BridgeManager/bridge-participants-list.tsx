'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BridgeParticipant, apiClient, UserSummary } from '@/lib/api';

interface BridgeParticipantsListProps {
  participants: BridgeParticipant[];
}

interface ParticipantWithUser extends BridgeParticipant {
  user?: UserSummary;
}

export const BridgeParticipantsList: React.FC<BridgeParticipantsListProps> = ({ participants }) => {
  const [users, setUsers] = useState<Map<number, UserSummary>>(new Map());

  const userIds = useMemo(() => {
    return participants
      .map((p) => p.user_id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [participants]);

  useEffect(() => {
    if (userIds.length === 0) {
      return;
    }

    apiClient
      .getUsersByIds(userIds)
      .then((response) => {
        if (response.success && response.data?.users) {
          const usersMap = new Map<number, UserSummary>();
          response.data.users.forEach((user) => {
            usersMap.set(user.id, user);
          });
          setUsers(usersMap);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch users:', error);
      });
  }, [userIds.join(',')]);

  const participantsWithUsers: ParticipantWithUser[] = useMemo(() => {
    return participants.map((participant) => ({
      ...participant,
      user: participant.user_id ? users.get(participant.user_id) : undefined,
    }));
  }, [participants, users]);

  const getDisplayName = (participant: ParticipantWithUser): string => {
    if (participant.user) {
      const name = participant.user.first_name || '';
      const username = participant.user.username ? `@${participant.user.username}` : '';
      return username ? `${name} ${username}`.trim() : name || participant.reference;
    }
    return participant.display_name || participant.reference;
  };

  const getInitials = (participant: ParticipantWithUser): string => {
    if (participant.user?.first_name) {
      return participant.user.first_name.charAt(0).toUpperCase();
    }
    return (participant.display_name || participant.reference).charAt(0).toUpperCase();
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Участники</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {participantsWithUsers.map((participant) => (
          <div
            key={participant.id}
            className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-semibold mb-2 shadow-md">
              {getInitials(participant)}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800 truncate w-full max-w-[120px]">
                {getDisplayName(participant)}
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                  participant.status === 'joined'
                    ? 'bg-green-100 text-green-700'
                    : participant.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : participant.status === 'left'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-red-100 text-red-700'
                }`}
              >
                {participant.status === 'joined' ? 'В сети' : participant.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

