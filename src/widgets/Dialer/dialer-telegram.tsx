import React, { useState, useEffect } from "react";
import { useSelector } from 'react-redux';
import Handset from '@/shared/ui/Handset/handset-telegram';
import { setManualCall } from '@/entities/WebRtc/model/slice';
import store, { RootState } from "@/app/store";

const DialerTelegram = () => {
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const invite = useSelector((state: RootState) => state.sip.invite);
  const userPhones = useSelector((state: RootState) => state.sip.userPhones);
  const [isClient, setIsClient] = useState(false);

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
      <Handset
        onCall={onCall}
        sessionState={sessionState}
        invite={invite}
        userPhones={userPhones}
      />
    </div>
  );
};

export default DialerTelegram;
