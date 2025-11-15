'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/app/store';
import { useAuth } from '@/hooks/useAuth';
import { apiClient, SipAccount, UserPhone } from '@/lib/api';
import { useInviteJoin } from '@/features/InviteJoin/model/useInviteJoin';
import {
  setInviteStatus,
  setSelectedAccount,
  setSipAccounts,
  setUserPhones,
} from '@/entities/WebRtc/model/slice';
import { getSipServiceInstance } from '@/entities/WebRtc/services/sipServiceInstance';

export type MiniPhoneView = 'general' | 'dialer';

interface UseMiniPhoneControllerResult {
  isLoadingAuth: boolean;
  isAuthenticated: boolean;
  user: ReturnType<typeof useAuth>['user'];
  authError: string | null;
  handleRetryAuth: () => void;
  handleRegistrationSuccess: (token: string) => Promise<void>;
  callMode: RootState['sip']['callMode'];
  inviteStatus: RootState['sip']['inviteStatus'];
  activeView: MiniPhoneView;
  setActiveView: (view: MiniPhoneView) => void;
  canUseDialer: boolean;
  showDialer: boolean;
  showGeneralScreen: boolean;
}

export const useMiniPhoneController = (): UseMiniPhoneControllerResult => {
  const dispatch = useDispatch<AppDispatch>();
  const searchParams = useSearchParams();

  const { user, isAuthenticated, isLoading, loginWithTelegram } = useAuth();

  const [isClient, setIsClient] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  
  // Вычисляем bridgeParam раньше, чтобы использовать его в начальном состоянии
  const bridgeParamFromUrl = searchParams?.get('bridge');
  
  // Получаем bridge ID из startParam, если Web App открыт через deep link
  // Важно: проверяем только на клиенте
  const bridgeParamFromStartParam = (() => {
    if (typeof window === 'undefined') return null;
    const tg = window.Telegram?.WebApp;
    return tg?.startParam || null;
  })();
  
  // Приоритет: URL параметр > startParam
  const bridgeParam = bridgeParamFromUrl || bridgeParamFromStartParam;
  
  // Если есть bridgeParam, блокируем view, чтобы предотвратить автоматическое переключение на 'dialer'
  const [activeView, setActiveViewState] = useState<MiniPhoneView>('general');
  // Начальное значение viewLocked: проверяем синхронно при инициализации
  const [viewLocked, setViewLocked] = useState(() => {
    // Проверяем URL параметр
    const urlParam = searchParams?.get('bridge');
    if (urlParam) return true;
    
    // Проверяем startParam (только на клиенте)
    if (typeof window !== 'undefined') {
      const tg = window.Telegram?.WebApp;
      if (tg?.startParam) return true;
    }
    return false;
  });

  const inviteToken = useSelector((state: RootState) => state.sip.inviteToken);
  const callMode = useSelector((state: RootState) => state.sip.callMode);
  const inviteStatus = useSelector((state: RootState) => state.sip.inviteStatus);
  const callPartner = useSelector((state: RootState) => state.sip.callPartner);
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const sipAccounts = useSelector((state: RootState) => state.sip.sipAccounts);
  const userPhones = useSelector((state: RootState) => state.sip.userPhones);

  const hasPhones = userPhones.length > 0;
  const { joinInvite } = useInviteJoin(isAuthenticated, user, sipAccounts);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Управление переключением view: сначала проверяем bridgeParam, потом автоматическое переключение
  useEffect(() => {
    if (!isClient) return;
    
    // Перепроверяем bridgeParam на клиенте (startParam может быть недоступен на SSR)
    const urlParam = searchParams?.get('bridge');
    const startParam = typeof window !== 'undefined' && window.Telegram?.WebApp?.startParam
      ? window.Telegram.WebApp.startParam
      : null;
    const hasBridgeParam = urlParam || startParam;
    
    // Приоритет 1: Если есть bridgeParam, блокируем view и устанавливаем 'general'
    // Это должно сработать ДО проверки hasPhones
    if (hasBridgeParam) {
      setActiveViewState('general');
      setViewLocked(true);
      return; // Выходим, не переключаем на 'dialer'
    }
    
    // Приоритет 2: Если view заблокирован, не переключаем
    // Это защита на случай, если viewLocked был установлен ранее
    if (viewLocked) {
      return;
    }
    
    // Приоритет 3: Автоматическое переключение на 'dialer' только если нет bridgeParam
    // Это сработает только если нет bridgeParam и view не заблокирован
    if (hasPhones) {
      setActiveViewState('dialer');
    } else if (activeView === 'dialer') {
      setActiveViewState('general');
    }
  }, [isClient, hasPhones, viewLocked, activeView, searchParams]);

  useEffect(() => {
    if (!isClient) return;

    const inviteParam = searchParams?.get('invite');
    const pendingInvite = typeof window !== 'undefined' ? localStorage.getItem('pending_invite') : null;

    if (inviteParam && inviteParam !== inviteToken && isAuthenticated && user) {
      localStorage.removeItem('pending_invite');
      joinInvite(inviteParam);
    } else if (pendingInvite && isAuthenticated && user && !inviteParam) {
      localStorage.removeItem('pending_invite');
      joinInvite(pendingInvite);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, searchParams, isAuthenticated, inviteToken, user]);

  useEffect(() => {
    if (
      callMode === 'invite' &&
      inviteStatus === 'ready' &&
      callPartner &&
      selectedAccount &&
      callPartner.sip_username
    ) {
      const initiateInviteCall = async () => {
        try {
          dispatch(setInviteStatus('connecting'));

          const sipService = getSipServiceInstance();
          if (!sipService) {
            throw new Error('SIP service not initialized');
          }

          const stateListener = (state: string) => {
            dispatch(setInviteStatus(state === 'Established' ? 'active' : 'connecting'));
          };

          await sipService.makeCallToSipAccount(callPartner.sip_username, stateListener);
        } catch (err) {
          console.error('Failed to initiate invite call:', err);
        }
      };

      initiateInviteCall();
    }
  }, [callMode, inviteStatus, callPartner, selectedAccount, dispatch]);

  useEffect(() => {
    if (isClient && !isAuthenticated && !isLoading && !attemptedAuth) {
      const handleTelegramAuth = async () => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          let initData = tg.initData;
          if (process.env.NODE_ENV === 'development') {
            const devParams = new URLSearchParams(window.location.search);
            initData = devParams.get('user') as string;
          }
          if (initData) {
            const result = await loginWithTelegram(initData);

            if (!result.success) {
              setAuthError(result.error || 'Ошибка аутентификации');
              console.error('Authentication failed:', result.error);
            } else {
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
            if (!granted && tg.showAlert) {
              tg.showAlert('Для работы приложения необходим доступ к микрофону');
            }
          });
        } else if (navigator.mediaDevices?.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
            console.log('Microphone access denied via WebRTC');
          });
        }
      } catch (error) {
        console.error('Error initializing Telegram Web App:', error);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const loadUserData = async () => {
      if (!isAuthenticated) return;

      try {
        const sipResponse = await apiClient.getSipAccounts();

        if (sipResponse.success && sipResponse.data) {
          const sipData = sipResponse.data;
          const accounts: SipAccount[] = Array.isArray(sipData)
            ? sipData
            : ((sipData as unknown as { accounts?: SipAccount[] }).accounts ?? []);

          dispatch(setSipAccounts(accounts));
          const activeAccount = accounts.find((acc) => acc.is_active);
          if (activeAccount) {
            dispatch(setSelectedAccount(activeAccount));
          }
        } else {
          console.error('Failed to load SIP accounts:', sipResponse.error);
        }

        const phonesResponse = await apiClient.getUserPhones();

        if (phonesResponse.success && phonesResponse.data) {
          const phonesPayload = phonesResponse.data;
          const phones: UserPhone[] = Array.isArray(phonesPayload)
            ? phonesPayload
            : phonesPayload.phones || [];

          dispatch(setUserPhones(phones));
        } else {
          console.error('Failed to load user phones:', phonesResponse.error);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [isAuthenticated, dispatch]);

  const handleRegistrationSuccess = useCallback(async (token: string) => {
    localStorage.setItem('auth_token', token);
    apiClient.setToken(token);

    try {
      const response = await apiClient.verifyToken();
      if (response.success && response.data) {
        window.location.reload();
      } else {
        console.error('Failed to verify token after registration');
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }, []);

  const handleRetryAuth = useCallback(() => {
    setAuthError(null);
    setAttemptedAuth(false);
  }, []);

  const setActiveView = useCallback((view: MiniPhoneView) => {
    // Если view заблокирован из-за bridgeParam, не позволяем переключать на 'dialer'
    if (viewLocked && view === 'dialer') {
      return;
    }
    setActiveViewState(view);
    setViewLocked(true);
  }, [viewLocked]);

  // Если есть bridgeParam, всегда показываем general screen
  const showDialer = activeView === 'dialer' && hasPhones && !bridgeParam;
  const showGeneralScreen = (activeView === 'general' || !hasPhones || !!bridgeParam);

  return useMemo(
    () => ({
      isLoadingAuth: isLoading,
      isAuthenticated,
      user,
      authError,
      handleRetryAuth,
      handleRegistrationSuccess,
      callMode,
      inviteStatus,
      activeView,
      setActiveView,
      canUseDialer: hasPhones,
      showDialer,
      showGeneralScreen,
    }),
    [
      activeView,
      authError,
      callMode,
      handleRegistrationSuccess,
      handleRetryAuth,
      inviteStatus,
      isAuthenticated,
      isLoading,
      setActiveView,
      showDialer,
      showGeneralScreen,
      user,
    ],
  );
};

