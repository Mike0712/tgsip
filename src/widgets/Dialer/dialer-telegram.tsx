import React, { useState, useEffect } from "react";
import { useSelector } from 'react-redux';
import Handset from '@/shared/ui/Handset/handset-telegram';
import { setManualCall } from '@/entities/WebRtc/model/slice';
import store, { RootState } from "@/app/store";
import CallHistory from '@/widgets/CallHistory/call-history';
import { setDialerPrefill } from '@/entities/WebRtc/model/slice';

const DialerTelegram = () => {
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const invite = useSelector((state: RootState) => state.sip.invite);
  const userPhones = useSelector((state: RootState) => state.sip.userPhones);
  const [isClient, setIsClient] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Incoming call: the answer button lives in Handset — go back to it.
  useEffect(() => {
    if (invite) setShowHistory(false);
  }, [invite]);

  // Предотвращаем ошибку гидратации
  useEffect(() => {
    setIsClient(true);
  }, []);

  const onCall = (dialingNumber: string) => {
    store.dispatch(setManualCall(dialingNumber));
    
    // Уведомление в Telegram (если поддерживается)
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.showAlert) {
      try {
        window.Telegram.WebApp.showAlert(`Звонок на номер: ${dialingNumber}`);
      } catch (error) {
        console.log('⚠️ showAlert not supported:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Handset stays mounted (just hidden) while history is open — it owns
          the ringtone <audio> and the SIP call controls. */}
      <div className={showHistory ? 'hidden' : undefined}>
        <Handset
          onCall={onCall}
          sessionState={sessionState}
          invite={invite}
          userPhones={userPhones}
        />
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            🕘 История
          </button>
        </div>
      </div>

      {showHistory && (
        <CallHistory
          onBack={() => setShowHistory(false)}
          onSelectNumber={(number) => {
            store.dispatch(setDialerPrefill(number));
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
};

export default DialerTelegram;
