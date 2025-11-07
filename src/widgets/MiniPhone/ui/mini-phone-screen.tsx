'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useMiniPhoneController, MiniPhoneView } from '@/features/MiniPhone/model/useMiniPhoneController';
import InviteManager from '@/widgets/InviteManager/invite-manager';
import AudioButton from '@/shared/ui/AudioButton/audio-button';
import { AlertProvider } from '@/shared/lib/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import { AuthErrorScreen } from '@/features/AuthError/ui/AuthErrorScreen';

const DialerTelegram = dynamic(() => import('@/widgets/Dialer/dialer-telegram'), {
  ssr: false,
  loading: () => <div className="bg-white rounded-2xl shadow-lg p-6 text-center">Загрузка...</div>,
});

interface ViewSwitcherProps {
  activeView: MiniPhoneView;
  onChange: (view: MiniPhoneView) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeView, onChange }) => (
  <div className="mb-4 flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
    <button
      type="button"
      onClick={() => onChange('dialer')}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        activeView === 'dialer'
          ? 'bg-blue-600 text-white shadow'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      📞 Звонки
    </button>
    <button
      type="button"
      onClick={() => onChange('general')}
      className={`ml-1 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        activeView === 'general'
          ? 'bg-blue-600 text-white shadow'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      🤝 Общий экран
    </button>
  </div>
);

interface GeneralScreenProps {
  showInviteWaiting: boolean;
  showInviteConnecting: boolean;
}

const GeneralScreen: React.FC<GeneralScreenProps> = ({ showInviteWaiting, showInviteConnecting }) => (
  <div className="space-y-4">
    <InviteManager />

    {showInviteWaiting && (
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-yellow-800 text-sm">⏳ Ожидание подключения второго участника...</p>
      </div>
    )}

    {showInviteConnecting && (
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2" />
          <span className="text-blue-700 text-sm">Подключение...</span>
        </div>
      </div>
    )}
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Проверка аутентификации...</p>
    </div>
  </div>
);

const PendingAuthScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Ожидание аутентификации...</p>
    </div>
  </div>
);

const MiniPhoneScreen: React.FC = () => {
  const controller = useMiniPhoneController();

  if (controller.isLoadingAuth) {
    return <LoadingScreen />;
  }

  if (controller.authError) {
    return (
      <AlertProvider>
        <AuthErrorScreen
          authError={controller.authError}
          onRetry={controller.handleRetryAuth}
          onRegistrationSuccess={controller.handleRegistrationSuccess}
        />
        <AlertContainer />
      </AlertProvider>
    );
  }

  if (!controller.isAuthenticated) {
    return <PendingAuthScreen />;
  }

  return (
    <AlertProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">📞 MiniPhone</h1>
            <p className="text-sm text-gray-600">SIP телефония в Telegram</p>

            {controller.user && (
              <div className="mt-3 p-3 bg-white rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-700">
                  👤 {controller.user.first_name} {controller.user.last_name || ''}
                </p>
                {controller.user.username && (
                  <p className="text-xs text-gray-500">@{controller.user.username}</p>
                )}
                <p className="text-xs text-green-600 mt-1">✅ Аутентифицирован</p>
              </div>
            )}
          </div>

          {controller.canUseDialer && (
            <ViewSwitcher activeView={controller.activeView} onChange={controller.setActiveView} />
          )}

          {controller.showGeneralScreen && (
            <GeneralScreen
              showInviteWaiting={controller.showInviteWaiting}
              showInviteConnecting={controller.showInviteConnecting}
            />
          )}

          {controller.showDialer && <DialerTelegram />}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">Powered by SIP.js & Telegram Web Apps</p>
          </div>
        </div>

        <AudioButton />
      </div>
      <AlertContainer />
    </AlertProvider>
  );
};

export default MiniPhoneScreen;

