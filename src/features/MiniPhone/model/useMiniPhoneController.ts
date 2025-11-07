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
  showInviteWaiting: boolean;
  showInviteConnecting: boolean;
}

export const useMiniPhoneController = (): UseMiniPhoneControllerResult => {
  const dispatch = useDispatch<AppDispatch>();
  const searchParams = useSearchParams();

  const { user, isAuthenticated, isLoading, loginWithTelegram } = useAuth();

  const [isClient, setIsClient] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  const [activeView, setActiveViewState] = useState<MiniPhoneView>('general');
  const [viewLocked, setViewLocked] = useState(false);

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

  useEffect(() => {
    if (hasPhones && !viewLocked) {
      setActiveViewState('dialer');
    }

    if (!hasPhones && activeView === 'dialer') {
      setActiveViewState('general');
    }
  }, [hasPhones, viewLocked, activeView]);

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
    setActiveViewState(view);
    setViewLocked(true);
  }, []);

  const showDialer = activeView === 'dialer' && hasPhones;
  const showGeneralScreen = activeView === 'general' || !hasPhones;

  const showInviteWaiting = callMode === 'invite' && inviteStatus === 'waiting';
  const showInviteConnecting = callMode === 'invite' && inviteStatus === 'connecting';

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
      showInviteWaiting,
      showInviteConnecting,
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
      showInviteConnecting,
      showInviteWaiting,
      user,
    ],
  );
};

