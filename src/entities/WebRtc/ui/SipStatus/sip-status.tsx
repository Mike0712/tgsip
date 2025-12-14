import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import store, { RootState } from "@/app/store";
import SipService from '../../services/sipService';
import { setSessionState, setToggleMute } from '@/entities/WebRtc/model/slice';
import { setSipServiceInstance } from '../../services/sipServiceInstance';
import { WakeLockManager } from '@/shared/ui/WakeLockManager/wake-lock-manager';
import cls from './sip-status.module.css';

let sipService: SipService | null = null;

const SipStatus = () => {
  const status = useSelector((state: RootState) => state.sip.status);
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const answer = useSelector((state: RootState) => state.sip.answer);
  const hangup = useSelector((state: RootState) => state.sip.hangup);
  const toggleMute = useSelector((state: RootState) => state.sip.toggleMute);
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const selectedCallerId = useSelector((state: RootState) => state.sip.selectedCallerId);
  const prevStatusRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);

  const stateListener = (state: string) => {
    store.dispatch(setSessionState(state))
  }

  useEffect(() => {
    if (selectedAccount) {
      sipService = new SipService(
        selectedAccount.sip_server,
        selectedAccount.sip_port,
        selectedAccount.sip_username,
        selectedAccount.secret,
        selectedAccount.turn_server || null
      );
      sipService.initialize();
      setSipServiceInstance(sipService); // Сохраняем глобально
      console.log('🔌 SIP Service initialized with:', {
        server: selectedAccount.sip_server,
        username: selectedAccount.sip_username
      });
    }

    return () => {
      // Cleanup events if needed
    };
  }, [selectedAccount]);
  const manualCall = useSelector((state: RootState) => state.sip.manualCall);
  useEffect(() => {
    if (manualCall) {
      const phoneNumber = manualCall;
      sipService && sipService.makeCall(phoneNumber, stateListener, selectedCallerId);
    }
  }, [manualCall, selectedCallerId]);
  useEffect(() => {
    if (answer) {
      sipService?.answer();
    }
  }, [answer]);

  useEffect(() => {
    if (hangup) {
      sipService?.hangup();
    }
  }, [hangup]);

  useEffect(() => {
    if (toggleMute) {
      sipService?.toggleMute();
      store.dispatch(setToggleMute(false));
    }
  }, [toggleMute]);

  // Автовосстановление при переходе из online в offline (только если НЕ в активной сессии)
  useEffect(() => {
    if (!selectedAccount) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    const isInActiveSession = sessionState === 'Established';

    // Если был online и стал offline - запускаем переподключение ТОЛЬКО если НЕ в активной сессии
    if (prevStatus === 'online' && status === 'offline' && !isReconnectingRef.current) {
      if (isInActiveSession) {
        // КАТАСТРОФА: разрыв во время активной сессии
        console.error('🚨 CRITICAL: SIP connection lost during active session! Wake Lock should prevent this.');
        // Не переподключаемся автоматически - это может разорвать канал
        return;
      }

      isReconnectingRef.current = true;
      console.log('🔄 SIP connection lost, attempting to reconnect (not in active session)...');

      // Очищаем предыдущий таймаут если есть
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Переподключаемся через небольшую задержку
      reconnectTimeoutRef.current = setTimeout(() => {
        if (selectedAccount && sipService) {
          try {
            // Пытаемся переинициализировать
            sipService.initialize();
            console.log('🔄 SIP Service reinitialized');
            isReconnectingRef.current = false;
          } catch (error) {
            console.error('❌ Failed to reconnect SIP:', error);
            // Если не получилось, пересоздаем сервис
            sipService = new SipService(
              selectedAccount.sip_server,
              selectedAccount.sip_port,
              selectedAccount.sip_username,
              selectedAccount.secret,
              selectedAccount.turn_server || null
            );
            sipService.initialize();
            setSipServiceInstance(sipService);
            console.log('🔄 SIP Service recreated and initialized');
            isReconnectingRef.current = false;
          }
        }
      }, 1500);
    }

    // Сбрасываем флаг переподключения когда статус снова становится online
    if (status === 'online') {
      isReconnectingRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [status, selectedAccount, sessionState]);


  // Page Visibility API - переподключаемся при возврате на страницу (только если НЕ в активной сессии)
  useEffect(() => {
    if (!selectedAccount || typeof document === 'undefined') return;
    
    const isInActiveSession = sessionState === 'Established';
    
    // Если в активной сессии - не переподключаемся, Wake Lock должен помочь
    if (isInActiveSession) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'offline' && !isReconnectingRef.current) {
        console.log('📱 Page became visible, reconnecting SIP (not in active session)...');
        isReconnectingRef.current = true;
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (selectedAccount && sipService) {
            try {
              sipService.initialize();
              console.log('🔄 SIP Service reinitialized after page visibility');
              isReconnectingRef.current = false;
            } catch (error) {
              console.error('❌ Failed to reconnect SIP:', error);
              sipService = new SipService(
                selectedAccount.sip_server,
                selectedAccount.sip_port,
                selectedAccount.sip_username,
                selectedAccount.secret,
                selectedAccount.turn_server || null
              );
              sipService.initialize();
              setSipServiceInstance(sipService);
              console.log('🔄 SIP Service recreated after page visibility');
              isReconnectingRef.current = false;
            }
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const handleFocus = () => {
      if (status === 'offline' && !isReconnectingRef.current) {
        handleVisibilityChange();
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [status, selectedAccount, sessionState]);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Показываем предупреждение если соединение разорвано во время активной сессии
  const isConnectionLostDuringSession = sessionState === 'Established' && status === 'offline';

  const isInActiveSession = sessionState === 'Established';

  return (
    <div className={cls.sipStatus}>
      <WakeLockManager isActive={isInActiveSession} />
      <span className={status === 'online' ? cls.online : cls.offline}>
        sip: {status}
      </span>
      {isConnectionLostDuringSession && (
        <div className="text-xs text-red-600 font-semibold mt-1">
          ⚠️ Соединение разорвано во время звонка!
        </div>
      )}
      {selectedAccount && (
        <div className="text-xs text-gray-500">
          {selectedAccount.sip_username}@{selectedAccount.sip_server}
        </div>
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

export default SipStatus;
