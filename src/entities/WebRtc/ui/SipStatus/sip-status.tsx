import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import store, { RootState } from "@/app/store";
import SipService from '../../services/sipService';
import { setSessionState } from '@/entities/WebRtc/model/slice';
import { setSipServiceInstance } from '../../services/sipServiceInstance';
import cls from './sip-status.module.css';

let sipService: SipService | null = null;

const SipStatus = () => {
  const status = useSelector((state: RootState) => state.sip.status);
  const answer = useSelector((state: RootState) => state.sip.answer);
  const hangup = useSelector((state: RootState) => state.sip.hangup);
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

  // Автовосстановление при переходе из online в offline
  useEffect(() => {
    if (!selectedAccount) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // Если был online и стал offline - запускаем переподключение
    if (prevStatus === 'online' && status === 'offline' && !isReconnectingRef.current) {
      isReconnectingRef.current = true;
      console.log('🔄 SIP connection lost, attempting to reconnect...');

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
  }, [status, selectedAccount]);

  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className={cls.sipStatus}>
      <span className={status === 'online' ? cls.online : cls.offline}>
        sip: {status}
      </span>
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
