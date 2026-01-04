'use client';

import React from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { AlertProvider } from '@/shared/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import MiniLogout from '@/entities/User/ui/Logout/MiniLogout';
import { useTranslation } from '@/shared/hooks/useTranslation';
import { withAuth } from '@/shared/hoc/withAuth';

const ProfilePageContent = () => {
  const { user } = useAuth();
  const t = useTranslation();

  if (!user) {
    return null;
  }

  return (
    <AlertProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('Profile')}</h1>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  {user.photo_url && (
                    <img
                      src={user.photo_url}
                      alt={user.first_name}
                      className="w-16 h-16 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-800">
                      {user.first_name} {user.last_name || ''}
                    </p>
                    {user.username && (
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">ID: </span>
                    <span className="text-gray-800">{user.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Telegram ID: </span>
                    <span className="text-gray-800">{user.telegram_id}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <MiniLogout />
              </div>
            </div>
          </div>
        </div>
      </div>
      <AlertContainer />
    </AlertProvider>
  );
};

const ProfilePage = withAuth(ProfilePageContent, { requireAuth: true, redirectTo: '/signin' });

export default ProfilePage;

