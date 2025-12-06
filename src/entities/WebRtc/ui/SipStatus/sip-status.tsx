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

  const [speakerOn, setSpeakerOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      // Просто управление громкостью (1 — громкая, 0.2 — "наушник", хоть примерно)
      audioRef.current.volume = speakerOn ? 1 : 0.2;
      audioRef.current.muted = false;
    }
  }, [speakerOn]);

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
