import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { setSipAccounts, setSelectedAccount, setUserPhones } from '@/entities/WebRtc/model/slice';
import store, { RootState } from '@/app/store';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { useSelector } from 'react-redux';
import AudioButton from '@/shared/ui/AudioButton/audio-button';
import InviteManager from '@/widgets/InviteManager/invite-manager';
import { getSipServiceInstance } from '@/entities/WebRtc/services/sipServiceInstance';
import { useInviteJoin } from '@/features/InviteJoin/model/useInviteJoin';
import { AuthErrorScreen } from '@/features/AuthError/ui/AuthErrorScreen';
import { AlertProvider } from '@/shared/lib/hooks/useAlert';
import { AlertContainer } from '@/shared/lib/AlertContainer';
import { setInviteStatus } from '@/entities/WebRtc/model/slice';

// Динамический импорт для предотвращения SSR ошибок
const DialerTelegram = dynamic(() => import('@/widgets/Dialer/dialer-telegram'), {
  ssr: false,
  loading: () => <div className="bg-white rounded-2xl shadow-lg p-6 text-center">Загрузка...</div>
});

const MiniPhone = () => {
  const { user, isAuthenticated, isLoading, loginWithTelegram } = useAuth();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  
  const inviteToken = useSelector((state: RootState) => state.sip.inviteToken);
  const callMode = useSelector((state: RootState) => state.sip.callMode);
  const inviteStatus = useSelector((state: RootState) => state.sip.inviteStatus);
  const callPartner = useSelector((state: RootState) => state.sip.callPartner);
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const sipAccounts = useSelector((state: RootState) => state.sip.sipAccounts);

  const { joinInvite } = useInviteJoin(isAuthenticated, user, sipAccounts);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Обработка invite параметра
  useEffect(() => {
    if (!isClient) return;
    
    const inviteParam = searchParams?.get('invite');
    const pendingInvite = localStorage.getItem('pending_invite');
    
    if (inviteParam && inviteParam !== inviteToken && isAuthenticated && user) {
      localStorage.removeItem('pending_invite');
      joinInvite(inviteParam);
    } else if (pendingInvite && isAuthenticated && user && !inviteParam) {
      localStorage.removeItem('pending_invite');
      joinInvite(pendingInvite);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, searchParams, isAuthenticated, inviteToken, user]);

  // Автоматический звонок когда оба участника готовы
  useEffect(() => {
    if (
      callMode === 'invite' &&
      inviteStatus === 'ready' &&
      callPartner &&
      selectedAccount &&
      callPartner.sip_username
    ) {
      initiateInviteCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteStatus, callPartner?.sip_username, selectedAccount?.id, callMode]);

  const initiateInviteCall = async () => {
    if (!callPartner?.sip_username || !selectedAccount) return;

    try {
      store.dispatch(setInviteStatus('connecting'));
      
      const sipService = getSipServiceInstance();
      if (!sipService) {
        throw new Error('SIP service not initialized');
      }

      const stateListener = (state: string) => {
        store.dispatch(setInviteStatus(state === 'Established' ? 'active' : 'connecting'));
      };

      await sipService.makeCallToSipAccount(callPartner.sip_username, stateListener);
    } catch (err) {
      console.error('Failed to initiate invite call:', err);
    }
  };

  // Аутентификация через Telegram
  useEffect(() => {
    if (isClient && !isAuthenticated && !isLoading && !attemptedAuth) {
      const handleTelegramAuth = async () => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          let initData = tg.initData;
          if (process.env.NODE_ENV === 'development') {
            const searchParams = new URLSearchParams(window.location.search);
            initData = searchParams.get('user') as string;
          }
          if (initData) {
            console.log('🔐 Attempting Telegram authentication...');
            const result = await loginWithTelegram(initData);

            if (!result.success) {
              setAuthError(result.error || 'Ошибка аутентификации');
              console.error('❌ Authentication failed:', result.error);
            } else {
              console.log('✅ Authentication successful:', result.user);
              setAuthError(null);
            }
          } else {
            setAuthError('Данные Telegram недоступны');
          }
        } else {
          setAuthError('Telegram Web App недоступен');
        }
      };

      setAttemptedAuth(true);
      handleTelegramAuth();
    }
  }, [isClient, isAuthenticated, isLoading, attemptedAuth, loginWithTelegram]);

  // Инициализация Telegram Web App
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;

      try {
        if (tg.expand) tg.expand();
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
        if (tg.MainButton) {
          tg.MainButton.setText('📞 Позвонить');
          tg.MainButton.show();
          tg.MainButton.disable();
        }
        if (tg.requestWriteAccess) {
          tg.requestWriteAccess((granted) => {
            if (granted) {
              console.log('✅ Microphone access granted');
            } else {
              console.log('❌ Microphone access denied');
              if (tg.showAlert) {
                tg.showAlert('Для работы приложения необходим доступ к микрофону');
              }
            }
          });
        } else if (navigator.mediaDevices?.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => console.log('✅ Microphone access granted via WebRTC'))
            .catch(() => console.log('❌ Microphone access denied via WebRTC'));
        }
      } catch (error) {
        console.error('❌ Error initializing Telegram Web App:', error);
      }
    }
  }, [isAuthenticated]);

  // Загрузка данных пользователя
  useEffect(() => {
    const loadUserData = async () => {
      if (!isAuthenticated) return;

      try {
        console.log('📡 Loading SIP accounts...');
        const sipResponse = await apiClient.getSipAccounts();

        if (sipResponse.success && sipResponse.data) {
          const accounts = (sipResponse.data as any).accounts || [];
          console.log('✅ SIP accounts loaded:', accounts);
          store.dispatch(setSipAccounts(accounts));
          const activeAccount = accounts.find((acc: any) => acc.is_active);
          if (activeAccount) {
            store.dispatch(setSelectedAccount(activeAccount));
            console.log('✅ Selected account:', activeAccount);
          }
        } else {
          console.error('❌ Failed to load SIP accounts:', sipResponse.error);
        }

        console.log('📱 Loading user phones...');
        const phonesResponse = await apiClient.getUserPhones();

        if (phonesResponse.success && phonesResponse.data) {
          const phones = phonesResponse.data.phones || [];
          console.log('✅ User phones loaded:', phones);
          store.dispatch(setUserPhones(phones));
        } else {
          console.error('❌ Failed to load user phones:', phonesResponse.error);
        }
      } catch (error) {
        console.error('❌ Error loading user data:', error);
      }
    };

    loadUserData();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка аутентификации...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <AlertProvider>
        <AuthErrorScreen
          authError={authError}
          onRetry={() => {
            setAuthError(null);
            setAttemptedAuth(false);
          }}
        />
        <AlertContainer />
      </AlertProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ожидание аутентификации...</p>
        </div>
      </div>
    );
  }

  return (
    <AlertProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              📞 MiniPhone
            </h1>
            <p className="text-sm text-gray-600">
              SIP телефония в Telegram
            </p>

            {user && (
              <div className="mt-3 p-3 bg-white rounded-lg shadow-sm">
                <p className="text-sm font-medium text-gray-700">
                  👤 {user.first_name} {user.last_name || ''}
                </p>
                {user.username && (
                  <p className="text-xs text-gray-500">
                    @{user.username}
                  </p>
                )}
                <p className="text-xs text-green-600 mt-1">
                  ✅ Аутентифицирован
                </p>
              </div>
            )}
          </div>

          {callMode === 'manual' && <InviteManager />}

          {callMode === 'invite' && inviteStatus === 'waiting' && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                ⏳ Ожидание подключения второго участника...
              </p>
            </div>
          )}
          
          {callMode === 'invite' && inviteStatus === 'connecting' && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-blue-700 text-sm">Подключение...</span>
              </div>
            </div>
          )}

          <DialerTelegram />

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Powered by SIP.js & Telegram Web Apps
            </p>
          </div>
        </div>

        <AudioButton />
      </div>
      <AlertContainer />
    </AlertProvider>
  );
};

export default MiniPhone;
