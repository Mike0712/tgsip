'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { useMiniPhoneController, MiniPhoneView } from '@/features/MiniPhone/model/useMiniPhoneController';
import AudioButton from '@/shared/ui/AudioButton/audio-button';
import { AlertProvider } from '@/shared/lib/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import { AuthErrorScreen } from '@/features/AuthError/ui/AuthErrorScreen';
import { BridgeManager } from '@/widgets/BridgeManager';
import FriendlyRetryScreen from '@/features/AuthError/ui/FriendlyRetryScreen';

const connectingSessionStates = new Set(['Establishing', 'Established']);
const connectingInviteStates = new Set(['creating', 'waiting', 'connecting', 'ready', 'active']);
const connectingCallStates = new Set(['waiting', 'connecting', 'active']);
const connectingBridgeStates = new Set(['creating', 'active', 'terminating']);

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
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const inviteStatus = useSelector((state: RootState) => state.sip.inviteStatus);
  const callStatus = useSelector((state: RootState) => state.sip.callStatus);
  const bridgeStatus = useSelector((state: RootState) => state.sip.bridgeStatus);

  const shouldShowAudioButton =
    connectingSessionStates.has(sessionState) ||
    connectingInviteStates.has(inviteStatus) ||
    connectingCallStates.has(callStatus) ||
    connectingBridgeStates.has(bridgeStatus);

  if (controller.isLoadingAuth) {
    return <LoadingScreen />;
  }

  if (controller.authError) {
    return (
      <AlertProvider>
        <FriendlyRetryScreen
          errorMsg={controller.authError}
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

            {controller.user && (
              <div className="mt-3 p-3 bg-white rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-700">
                  👤 {controller.user.first_name} {controller.user.last_name || ''}
                </p>
              </div>
            )}
          </div>

          {controller.user && (
            <>
            <p className="text-xs text-gray-500 text-center -mt-4 mb-4">{controller.user.username ? `@${controller.user.username}` : controller.user.first_name}</p>
            <p className="text-xs text-green-600 text-center -mt-3 mb-4">✅ Подтвержден!!!</p>
            </>
          )}

          {/* {shouldShowAudioButton && <AudioButton />} */}
          
          {controller.canUseDialer && (
            <ViewSwitcher activeView={controller.activeView} onChange={controller.setActiveView} />
          )}

          {controller.showGeneralScreen && <BridgeManager />}

          {controller.showDialer && <DialerTelegram />}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">Powered by SIP.js & Telegram Web Apps</p>
          </div>
        </div>
      </div>
      <AlertContainer />
    </AlertProvider>
  );
};

export default MiniPhoneScreen;

