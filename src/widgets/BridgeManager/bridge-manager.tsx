'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { useBridgeDialer } from '@/features/BridgeDialer/model/useBridgeDialer';
import { useAlert } from '@/shared/lib/hooks/useAlert';
import { useAuth } from '@/shared/lib/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
import { getSipServiceInstance } from '@/entities/WebRtc/services/sipServiceInstance';
import { BridgeSession } from '@/lib/api';
import { setCallStatus, setSessionState } from '@/entities/WebRtc/model/slice';
import store from '@/app/store';
import { BridgeParticipantsList } from './bridge-participants-list';
import { BridgeShareBlock } from './bridge-share-block';
import { useSSE } from '@/shared/lib/hooks/useSSE';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile|ios|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

const formatStatus = (status: ReturnType<typeof useBridgeDialer>['bridgeStatus']) => {
  switch (status) {
    case 'creating':
      return 'Создаём сессию...';
    case 'active':
      return 'Сессия активна';
    case 'terminating':
      return 'Завершаем сессию...';
    case 'completed':
      return 'Сессия завершена';
    case 'failed':
      return 'Ошибка сессии';
    default:
      return 'Сессия не создана';
  }
};

const BridgeManager: React.FC = () => {
  const dispatch = useDispatch();
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const callStatus = useSelector((state: RootState) => state.sip.callStatus);
  const {
    bridgeSession,
    bridgeParticipants,
    bridgeStatus,
    isProcessing,
    error,
    startBridge,
    endBridge,
    resetBridgeState,
    loadSession,
    refreshSession,
  } = useBridgeDialer();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const { subscribe, unsubscribe, on, off } = useSSE(user?.id ? user.id.toString() : "");
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mobile = isMobileDevice();

  // Проверяем, находится ли текущий пользователь в разговоре
  const isUserInCall = useMemo(() => {
    if (!user?.id || !bridgeParticipants.length) {
      return false;
    }
    const isParticipantJoined = bridgeParticipants.some(
      (participant) => participant.user_id === user.id && participant.status === 'joined'
    );
    return sessionState === 'Established' && isParticipantJoined;
  }, [user?.id, bridgeParticipants, sessionState]);
  const bridgeParamFromStartApp = searchParams?.get('startapp');
  const bridgeParamFromStartParam = (() => {
    if (typeof window === 'undefined') return null;
    const tg = window.Telegram?.WebApp;
    return tg?.initDataUnsafe?.start_param || null;
  })();
  
  const bridgeParam = bridgeParamFromStartApp || bridgeParamFromStartParam;
  const hasLoadedFromLink = useRef<string | null>(null);
  const isLoadingSession = useRef(false);
  const isRefreshing = useRef(false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  const deepLink = useMemo(() => {
    if (!bridgeSession || !botUsername) return null;
    return `https://t.me/${botUsername}?startapp=${bridgeSession.id}`;
  }, [bridgeSession, botUsername]);

  const appLink = useMemo(() => {
    if (!bridgeSession || process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/miniphone?startapp=${bridgeSession.id}`;
  }, [bridgeSession]);

  const handleCreate = async () => {
    await startBridge({
      metadata: {
        origin: 'miniphone',
        created_at: new Date().toISOString(),
      },
    });
  };

  const handleJoin = async () => {
    if (!bridgeSession?.id) {
      showAlert('Нет активной сессии', 'Создай сессию или обнови страницу.', 'warning');
      return;
    }

    if (!selectedAccount?.sip_username) {
      showAlert('Нет SIP аккаунта', 'Выбери или подключи SIP аккаунт и попробуй снова.', 'warning');
      return;
    }

    const sipService = getSipServiceInstance();
    if (!sipService) {
      showAlert('SIP недоступен', 'Переподключите SIP перед присоединением.', 'warning');
      return;
    }

    const dialTarget = (bridgeSession as BridgeSession).join_extension || null;
    
    if (!dialTarget) {
      showAlert('Нет маршрута', 'Для этой сессии не задано направление звонка.', 'warning');
      return;
    }

    try {
      setIsConnecting(true);
      dispatch(setCallStatus('connecting'));

      const stateListener = (state: string) => {
        store.dispatch(setSessionState(state));
        if (state === 'Established') {
          setIsConnecting(false);
          dispatch(setCallStatus('active'));
          // Включаем звук на мобильных устройствах
          if (audioRef.current && mobile) {
            audioRef.current.play().catch(err => {
              console.warn('Failed to play audio:', err);
            });
          }
        } else if (state === 'Terminated' || state === 'Canceled') {
          setIsConnecting(false);
          dispatch(setCallStatus('idle'));
        }
      };

      // Пытаемся включить звук сразу при клике (для мобильных)
      if (audioRef.current && mobile) {
        audioRef.current.play().catch(err => {
          console.warn('Failed to play audio on click:', err);
        });
      }

      await sipService.makeCall(
        dialTarget,
        stateListener,
        selectedAccount.sip_username,
        [`X-bridgeId: ${bridgeSession.id}`],
      );
    } catch (error) {
      console.error('Failed to dial bridge extension:', error);
      setIsConnecting(false);
      dispatch(setCallStatus('idle'));
      showAlert('Ошибка звонка', 'Не удалось инициировать звонок. Попробуй ещё раз.', 'error');
    }
  };

  const handleHangup = () => {
    const sipService = getSipServiceInstance();
    if (sipService) {
      sipService.hangup();
    } else {
      console.warn('SIP service unavailable (no instance)');
    }
  };

  // --- ЧИСТАЯ ПОДПИСКА НА SSE ---
  useEffect(() => {
    if (!user?.id || !bridgeSession?.id) return;
    subscribe('participant_joined', bridgeSession.id);
    const handler = (data: any) => {
      refreshSession();
    };
    on('participant_joined', handler);
    return () => {
      unsubscribe('participant_joined', bridgeSession.id);
      off('participant_joined', handler);
    };
  }, [user?.id, bridgeSession?.id]);

  // --- ЧИСТАЯ ЗАГРУЗКА SESSION ПО LINK ---
  useEffect(() => {
    if (!bridgeParam || hasLoadedFromLink.current === bridgeParam) return;
    if (bridgeSession && bridgeSession.id === bridgeParam) return;
    if (isLoadingSession.current) return;

    isLoadingSession.current = true;
    loadSession(bridgeParam)
      .then((success) => {
        isLoadingSession.current = false;
        if (success) hasLoadedFromLink.current = bridgeParam;
      })
      .catch(() => {
        isLoadingSession.current = false;
      });
  }, [bridgeParam, bridgeSession, loadSession]);

  // --- ЧИСТАЯ ОБРАБОТКА СБРОСА СОЕДИНЕНИЯ ---
  useEffect(() => {
    if (['Terminated', 'Canceled'].includes(sessionState)) setIsConnecting(false);
    if (sessionState === 'Terminated' && callStatus === 'connecting') dispatch(setCallStatus('idle'));
  }, [sessionState, callStatus, dispatch]);

  // Сбрасываем состояние подключения при завершении звонка
  useEffect(() => {
    if (sessionState === 'Terminated' || sessionState === 'Canceled') {
      setIsConnecting(false);
      if (callStatus === 'connecting') {
        dispatch(setCallStatus('idle'));
      }
    }
  }, [sessionState, callStatus, dispatch]);

  useEffect(() => {
    if (audioRef.current) {
      // Просто управление громкостью (1 — громкая, 0.2 — "наушник", хоть примерно)
      audioRef.current.volume = speakerOn ? 1 : 0.2;
      audioRef.current.muted = false;
      // Пытаемся включить звук при изменении режима (для мобильных)
      if (mobile && isUserInCall) {
        audioRef.current.play().catch(err => {
          console.warn('Failed to play audio on speaker toggle:', err);
        });
      }
    }
  }, [speakerOn, mobile, isUserInCall]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!bridgeSession?.id) {
      return;
    }

    if (!['creating', 'active'].includes(bridgeStatus)) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || isRefreshing.current) {
        return;
      }      
    };

    void tick();

    return () => {
      cancelled = true;
    };
  }, [bridgeSession?.id, bridgeStatus]);

  const handleEnd = async () => {
    await endBridge();
  };

  const handleReset = () => {
    resetBridgeState();
  };


  return (
    <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {formatStatus(bridgeStatus)}
          </span>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {!bridgeSession && (
        <button
          onClick={handleCreate}
          disabled={isProcessing || bridgeStatus === 'creating'}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${isProcessing || bridgeStatus === 'creating'
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          Создать созвон
        </button>
      )}

      {bridgeSession && (
        <>
          {!isUserInCall && <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium">ID сессии</span>
              <code className="text-xs text-gray-500">{bridgeSession.id}</code>
            </div>
            {bridgeSession.target && (
              <p className="mt-2 text-xs text-gray-500">Target: {bridgeSession.target}</p>
            )}
          </div>}

          {!isUserInCall && <BridgeShareBlock deepLink={deepLink} appLink={appLink} />}

          <div className="space-y-2">
            {isConnecting || callStatus === 'connecting' ? (
              <div className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Подключение...</span>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={isProcessing || ['terminating', 'completed', 'failed'].includes(bridgeStatus) || isUserInCall}
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isProcessing || ['terminating', 'completed', 'failed'].includes(bridgeStatus) || isUserInCall
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {isUserInCall ? 'В разговоре' : 'Присоединиться к сессии'}
              </button>
            )}
            {user?.id && bridgeSession?.creator_user_id && user.id === bridgeSession.creator_user_id && !isUserInCall && (
              <div className="flex gap-2">
                <button
                  onClick={handleEnd}
                  disabled={isProcessing || bridgeStatus === 'terminating'}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isProcessing || bridgeStatus === 'terminating'
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                  Завершить сессию
                </button>
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Сбросить
                </button>
              </div>
            )}
          </div>
          {bridgeParticipants.length > 0 && isUserInCall && (
            <>
              {mobile && (
                <button
                  style={{
                    margin: '12px 0',
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                  }}
                  onClick={() => {
                    setSpeakerOn((prev) => !prev);
                    // Принудительно включаем звук при клике
                    if (audioRef.current) {
                      audioRef.current.play().catch(err => {
                        console.warn('Failed to play audio on button click:', err);
                      });
                    }
                  }}
                >
                  {speakerOn ? '🔊 Громкая связь' : '🦻 В наушник'}
                </button>
              )}
              <BridgeParticipantsList participants={bridgeParticipants} onHangup={handleHangup} />
            </>
          )}
        </>
      )}
      <audio
        id="mediaElement"
        ref={audioRef}
        autoPlay
        playsInline
      />
    </div>
  );
};

export default BridgeManager;

