import React, { useEffect, useState, useRef } from "react";
import cls from "./handset.module.css";
import { PhoneIcon, XIcon } from "@heroicons/react/solid";
import { useSelector } from 'react-redux';
import store, { RootState } from "@/app/store";
import { setAnswer, setInvite, setHangup } from '@/entities/WebRtc/model/slice';

interface HandsetProps {
  onCall: (dialingNumber: string) => void
  sessionState: string,
  invite: boolean
};

const Handset = (props: HandsetProps) => {
  const { onCall, sessionState, invite } = props;
  const [dialingNumber, setDialingNumber] = useState("");
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const handleDigitClick = (digit: string) => {
    setDialingNumber(dialingNumber + digit);
  };

  const ringRef = useRef<HTMLAudioElement | null>(null);
  const playRing = () => {
    if (ringRef.current) {
      ringRef.current.loop = true;
      ringRef.current.play();
    }
  };

  const pauseRing = () => {
    ringRef.current && ringRef.current.pause();
  };
  useEffect(() => {
    if (true === invite) {
      playRing();
    } else {
      pauseRing();
    }

  }, [invite])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDialingNumber(e.target.value);
  };

  const handleCall = () => {
    onCall(dialingNumber);
  };

  const handleHangup = () => {
    setDialingNumber("");
    store.dispatch(setHangup(true));
  };

  const handleAnswer = () => {
    store.dispatch(setInvite(false));
    store.dispatch(setAnswer(true));
  }

  return (
    <div className={cls.handset}>
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
      <div className={cls.phoneBar}>
        <input
          type="text"
          value={dialingNumber}
          onChange={handleChange}
          className={cls.input}
          placeholder="Dialing number"
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
    </div>
  );
};

export default Handset;
