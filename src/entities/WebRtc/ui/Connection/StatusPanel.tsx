import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import store, { RootState } from "@/app/store";
import SipService from '../../services/sipService';
import { setSessionState, setToggleMute, setManualCall } from '@/entities/WebRtc/model/slice';
import { setSipServiceInstance, getSipServiceInstance } from '../../services/sipServiceInstance';
import { WakeLockManager } from '@/shared/ui/WakeLockManager/wake-lock-manager';
import cls from './status-panel.module.css';

let sipService: SipService | null = null;

const StatusPanel = () => {
  const status = useSelector((state: RootState) => state.sip.status);
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const answer = useSelector((state: RootState) => state.sip.answer);
  const hangup = useSelector((state: RootState) => state.sip.hangup);
  const toggleMute = useSelector((state: RootState) => state.sip.toggleMute);
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const selectedCallerId = useSelector((state: RootState) => state.sip.selectedCallerId);
  const prevStatusRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

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
      setSipServiceInstance(sipService);
    }
  }, [selectedAccount]);

  const manualCall = useSelector((state: RootState) => state.sip.manualCall);
  useEffect(() => {
    if (manualCall) {
      const phoneNumber = manualCall;
      sipService && sipService.makeCall(phoneNumber, stateListener, selectedCallerId);
      // One-shot trigger: reset so calling the same number again (e.g. after
      // "Занято") changes the value and re-runs this effect.
      store.dispatch(setManualCall(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualCall]);

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

  useEffect(() => {
    if (!selectedAccount) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    const isInActiveSession = sessionState === 'Established';

    if (prevStatus === 'online' && status === 'offline' && !isReconnecting) {
      if (isInActiveSession) {
        console.error('🚨 CRITICAL: Connection lost during active session!');
        return;
      }

      setIsReconnecting(true);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (selectedAccount && sipService) {
          try {
            sipService.initialize();
            setIsReconnecting(false);
          } catch (error) {
            console.error('❌ Failed to reconnect:', error);
            sipService = new SipService(
              selectedAccount.sip_server,
              selectedAccount.sip_port,
              selectedAccount.sip_username,
              selectedAccount.secret,
              selectedAccount.turn_server || null
            );
            sipService.initialize();
            setSipServiceInstance(sipService);
            setIsReconnecting(false);
          }
        }
      }, 1500);
    }

    if (status === 'online') {
      setIsReconnecting(false);
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

  // Page Visibility API - переподключаемся при возврате на страницу
  useEffect(() => {
    if (!selectedAccount || typeof document === 'undefined') return;
    
    const isInActiveSession = sessionState === 'Established';
    if (isInActiveSession) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'offline' && !isReconnecting) {
        setIsReconnecting(true);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (selectedAccount && sipService) {
            try {
              sipService.initialize();
              setIsReconnecting(false);
            } catch (error) {
              console.error('❌ Failed to reconnect:', error);
              sipService = new SipService(
                selectedAccount.sip_server,
                selectedAccount.sip_port,
                selectedAccount.sip_username,
                selectedAccount.secret,
                selectedAccount.turn_server || null
              );
              sipService.initialize();
              setSipServiceInstance(sipService);
              setIsReconnecting(false);
            }
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const handleFocus = () => {
      if (status === 'offline' && !isReconnecting) {
        handleVisibilityChange();
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [status, selectedAccount, sessionState, isReconnecting]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const isConnectionLostDuringSession = sessionState === 'Established' && status === 'offline';
  const isInActiveSession = sessionState === 'Established';

  const ServerIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="4" rx="1" />
      <rect x="2" y="7" width="20" height="4" rx="1" />
      <rect x="2" y="11" width="20" height="4" rx="1" />
      <line x1="6" y1="5" x2="6.01" y2="5" />
      <line x1="6" y1="9" x2="6.01" y2="9" />
      <line x1="6" y1="13" x2="6.01" y2="13" />
    </svg>
  );

  const getConnectionStatus = () => {
    if (status === 'online') {
      return {
        label: 'Подключено',
        icon: <ServerIcon />,
        className: cls.statusOnline
      };
    } else if (isReconnecting) {
      return {
        label: 'Переподключение...',
        icon: <ServerIcon />,
        className: cls.statusReconnecting
      };
    } else {
      return {
        label: 'Отключено',
        icon: <ServerIcon />,
        className: cls.statusOffline
      };
    }
  };

  // Определяем статус сессии
  const getSessionStatus = () => {
    switch (sessionState) {
      case 'Established':
        return { label: 'Активный звонок', icon: '📞', className: cls.sessionActive };
      case 'Establishing':
      case 'Trying':
      case 'Ringing':
      case 'Progress':
        return { label: 'Идет соединение...', icon: '📲', className: cls.sessionConnecting };
      case 'Busy':
        return { label: 'Занято', icon: '🚫', className: cls.sessionBusy };
      case 'Timeout':
        return { label: 'Таймаут', icon: '⏱️', className: cls.sessionTimeout };
      case 'Terminated':
        return null;
      default:
        return null;
    }
  };

  const handleReconnect = () => {
    if (status === 'offline' && selectedAccount && !isReconnecting) {
      setIsReconnecting(true);
      
      const existingService = getSipServiceInstance() || sipService;
      
      try {
        if (existingService) {
          existingService.initialize();
        } else if (selectedAccount) {
          sipService = new SipService(
            selectedAccount.sip_server,
            selectedAccount.sip_port,
            selectedAccount.sip_username,
            selectedAccount.secret,
            selectedAccount.turn_server || null
          );
          sipService.initialize();
          setSipServiceInstance(sipService);
        }
      } catch (error) {
        console.error('❌ Failed to reconnect:', error);
        if (selectedAccount) {
          sipService = new SipService(
            selectedAccount.sip_server,
            selectedAccount.sip_port,
            selectedAccount.sip_username,
            selectedAccount.secret,
            selectedAccount.turn_server || null
          );
          sipService.initialize();
          setSipServiceInstance(sipService);
        }
      }
    }
  };

  const connectionStatus = getConnectionStatus();
  const sessionStatus = getSessionStatus();
  const isOffline = status === 'offline';

  return (
    <>
      <WakeLockManager isActive={isInActiveSession} />
      <div className={cls.statusPanel}>
        <div className={cls.statusRow}>
          <div className={cls.statusItem}>
            <span 
              className={`${cls.statusIndicator} ${connectionStatus.className} ${isOffline ? cls.clickable : ''}`}
              onClick={isOffline ? handleReconnect : undefined}
              title={isOffline ? 'Нажмите для переподключения' : undefined}
              style={isOffline ? { cursor: 'pointer' } : undefined}
            >
              {connectionStatus.icon}
            </span>
            <div className={cls.statusInfo}>
              <span className={cls.statusLabel}>Сервер</span>
              <span className={cls.statusValue}>{connectionStatus.label}</span>
            </div>
          </div>

          {sessionStatus && (
            <div className={cls.statusItemVertical}>
              <span className={cls.statusIcon}>{sessionStatus.icon}</span>
              <div className={cls.statusInfo}>
                <span className={cls.statusLabel}>Сессия</span>
                <span className={`${cls.statusValue} ${sessionStatus.className}`}>
                  {sessionStatus.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {isConnectionLostDuringSession && (
          <div className={cls.warning}>
            ⚠️ Соединение разорвано во время звонка
          </div>
        )}
      </div>

      <audio
        id="mediaElement"
        ref={audioRef}
        autoPlay
        playsInline
      />
    </>
  );
};

export default StatusPanel;
