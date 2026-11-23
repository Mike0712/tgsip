import React, { useEffect, useState, useRef, useCallback } from "react";
import cls from "./handset.module.css";
import { PhoneIcon, XIcon } from "@heroicons/react/solid";
import { useSelector } from 'react-redux';
import store, { RootState } from "@/app/store";
import { setAnswer, setInvite, setHangup, setSelectedCallerId as setReduxCallerId, setDialerPrefill } from '@/entities/WebRtc/model/slice';
import DtmfPad from "@/entities/WebRtc/ui/DtmfPad/dtmf-pad";
import { getSipServiceInstance } from "@/entities/WebRtc/services/sipServiceInstance";
import { UserPhone } from "@/lib/api";
import { outgoingCallDetails, outgoingCallLabel } from "@/entities/WebRtc/model/outgoingCall";
import { unlockTones } from "@/entities/WebRtc/services/callTones";

interface HandsetProps {
  onCall: (dialingNumber: string) => void
  sessionState: string,
  invite: boolean,
  userPhones: UserPhone[]
};

const Handset = (props: HandsetProps) => {
  const { onCall, sessionState, invite, userPhones } = props;
  const [dialingNumber, setDialingNumber] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [selectedCallerId, setSelectedCallerId] = useState<UserPhone | null>(null);
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const outgoingCall = useSelector((state: RootState) => state.sip.outgoingCall);
  const dialerPrefill = useSelector((state: RootState) => state.sip.dialerPrefill);

  // Number tapped in the call history tab
  useEffect(() => {
    if (dialerPrefill) {
      setDialingNumber(dialerPrefill);
      store.dispatch(setDialerPrefill(null));
    }
  }, [dialerPrefill]);

  // Предотвращаем ошибку гидратации
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Автоматически выбираем первый доступный caller ID
  useEffect(() => {
    if (userPhones.length > 0 && !selectedCallerId) {
      setSelectedCallerId(userPhones[0]);
    }
  }, [userPhones, selectedCallerId]);

  const handleDigitClick = (digit: string) => {
    setDialingNumber(dialingNumber + digit);

    // Haptic feedback для Telegram (если поддерживается)
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      } catch (error) {
        console.log('⚠️ Haptic feedback not supported:', error);
      }
    }
  };

  const ringRef = useRef<HTMLAudioElement | null>(null);
  const playRing = useCallback(() => {
    if (ringRef.current) {
      ringRef.current.loop = true;
      ringRef.current.play();
    }

    // Уведомление в Telegram (если поддерживается)
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.showAlert) {
      try {
        window.Telegram.WebApp.showAlert('📞 Входящий звонок!');
      } catch (error) {
        console.log('⚠️ showAlert not supported:', error);
      }
    }
  }, [isClient]);

  const pauseRing = () => {
    ringRef.current && ringRef.current.pause();
  };

  useEffect(() => {
    if (true === invite) {
      playRing();
    } else {
      pauseRing();
    }
  }, [invite, playRing])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDialingNumber(e.target.value);
  };

  const handleHangup = () => {
    setDialingNumber("");
    store.dispatch(setHangup(true));

    // Haptic feedback (если поддерживается)
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
      } catch (error) {
        console.log('⚠️ Haptic feedback not supported:', error);
      }
    }
  };

  const handleAnswer = useCallback(() => {
    store.dispatch(setInvite(false));
    store.dispatch(setAnswer(true));

    // Haptic feedback (если поддерживается)
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } catch (error) {
        console.log('⚠️ Haptic feedback not supported:', error);
      }
    }
  }, [isClient]);

  const handleCall = useCallback(() => {
    if (dialingNumber.trim()) {
      // Call/busy tones are WebAudio — the context may only start inside a tap.
      unlockTones();
      // Сохраняем выбранный caller ID в Redux
      store.dispatch(setReduxCallerId(selectedCallerId?.phone_number || null));
      
      onCall(dialingNumber);
      
      // Логируем информацию о звонке
      console.log('📞 Making call:', {
        to: dialingNumber,
        from: selectedCallerId?.phone_number || 'Default',
        callerId: selectedCallerId
      });

      // Haptic feedback (если поддерживается)
      if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
        try {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        } catch (error) {
          console.log('⚠️ Haptic feedback not supported:', error);
        }
      }
    }
  }, [dialingNumber, selectedCallerId, onCall, isClient]);

  // Синхронизация с Telegram MainButton
  useEffect(() => {
    if (isClient && typeof window !== 'undefined' && window.Telegram?.WebApp?.MainButton) {
      const tg = window.Telegram.WebApp;

      try {
        // Обновляем текст главной кнопки в зависимости от состояния
        if (invite) {
          tg.MainButton.setText('📞 Принять');
          tg.MainButton.onClick(handleAnswer);
        } else if (['Established', 'Establishing'].includes(sessionState)) {
          tg.MainButton.setText('📞 В разговоре');
          tg.MainButton.disable();
        } else if (dialingNumber.trim()) {
          tg.MainButton.setText('📞 Позвонить');
          tg.MainButton.enable();
          tg.MainButton.onClick(handleCall);
        } else {
          tg.MainButton.setText('📞 Позвонить');
          tg.MainButton.disable();
        }
      } catch (error) {
        console.log('⚠️ MainButton not supported:', error);
      }
    }
  }, [isClient, dialingNumber, sessionState, invite, handleAnswer, handleCall]);

  return (
    <div className={cls.handset}>
      {/* Селектор Caller ID */}
      {userPhones.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📞 Звонок от
          </label>
          <select
            value={selectedCallerId?.id || ''}
            onChange={(e) => {
              const phoneId = parseInt(e.target.value);
              const phone = userPhones.find(p => p.id === phoneId);
              setSelectedCallerId(phone || null);
            }}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {userPhones.map((phone) => (
              <option key={phone.id} value={phone.id}>
                {phone.phone_number || 'Номер не указан'} 
                {/* {phone.server_url && ` (${phone.server_url})`} */}
              </option>
            ))}
          </select>
          {selectedCallerId && (
            <p className="text-xs text-gray-500 mt-1">
              Выбран: {selectedCallerId.phone_number}
            </p>
          )}
        </div>
      )}

      {outgoingCall && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-center ${
            outgoingCall.phase === 'ended' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">{outgoingCallLabel(outgoingCall)}</p>
          {outgoingCallDetails(outgoingCall) && (
            <p className="text-xs opacity-70 mt-0.5">{outgoingCallDetails(outgoingCall)}</p>
          )}
        </div>
      )}

      {sessionState === 'Established' ? (
        <DtmfPad
          onDigit={(digit) => getSipServiceInstance()?.sendDTMF(digit)}
          disabled={false}
        />
      ) : (
        <div className={cls.keypad}>
          {digits.map((digit) => (
            <button
              key={digit}
              className={cls.digitButton}
              onClick={() => handleDigitClick(digit)}
            >
              {digit}
            </button>
          ))}
        </div>
      )}
      <div className={cls.phoneBar}>
        <input
          type="text"
          value={dialingNumber}
          onChange={handleChange}
          className={cls.input}
          placeholder="Введите номер"
        />
      </div>
      <div className={cls.actions}>
        {invite ?
          <div className={cls.phoneIconContainer}>
            <div className={cls.wave} onClick={handleAnswer}></div>
            <div className="wave">
              <PhoneIcon className={cls.phoneIcon} />
            </div>
          </div> :
          !['Established', 'Establishing'].includes(sessionState) && <button className={cls.callButton} onClick={handleCall}>
            <PhoneIcon className={cls.icon} />
          </button>}
        <button className={cls.hangupButton} onClick={handleHangup}>
          <XIcon className={cls.icon} />
        </button>
      </div>
      <audio ref={ringRef} src="/telephone-ring-01a.mp3" preload="auto" />
    </div >
  );
};

export default Handset;
