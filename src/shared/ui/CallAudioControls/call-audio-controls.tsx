'use client';

import React, { useEffect, useRef, useState } from 'react';
import cls from './call-audio-controls.module.css';
import { useDispatch } from 'react-redux';
import { setToggleMute } from '@/entities/WebRtc/model/slice';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile|ios|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

interface CallAudioControlsProps {
  audioRef: React.RefObject<HTMLAudioElement>;
}

export const CallAudioControls: React.FC<CallAudioControlsProps> = ({ audioRef }) => {
  const [speakerOn, setSpeakerOn] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(!isMobileDevice()); // На mobile по умолчанию выключен, на desktop включен
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const mobile = isMobileDevice();
  const dispatch = useDispatch();

  useEffect(() => {
    if (audioRef.current) {
      // Управление громкостью (1 — громкая, 0.2 — "наушник")
      const targetVolume = speakerOn ? 1 : 0.2;
      
      // Устанавливаем muted сразу (синхронно) - это критично для работы
      audioRef.current.muted = !audioEnabled;
      
      // Устанавливаем громкость с небольшой задержкой, чтобы убедиться что элемент готов
      const timer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = targetVolume;
          console.log(`[CallAudioControls] Volume set: ${audioRef.current.volume}, speakerOn: ${speakerOn}, muted: ${audioRef.current.muted}`);
        }
      }, 0);
      
      // Пытаемся включить звук при изменении режима (для мобильных)
      if (mobile && audioEnabled && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.warn('Failed to play audio on speaker toggle:', err);
        });
      }
      
      return () => clearTimeout(timer);
    }
  }, [speakerOn, audioEnabled, mobile, audioRef]);

  const handleMicrophoneToggle = () => {
    const newAudioEnabled = !audioEnabled;
    console.log(`[CallAudioControls] Toggling microphone: ${audioEnabled} -> ${newAudioEnabled}`);
    setAudioEnabled(newAudioEnabled);

    // Не устанавливаем muted здесь - пусть useEffect это делает синхронно
    // Но пытаемся включить звук при включении
    if (newAudioEnabled && audioRef.current) {
      // При включении звука пытаемся его воспроизвести
      audioRef.current.play().catch(err => {
        console.warn('Failed to play audio on microphone toggle:', err);
      });
    }
  };

  const handleMicrophoneMuteToggle = () => {
    const newMutedState = !microphoneMuted;
    setMicrophoneMuted(newMutedState);
    console.log(`[CallAudioControls] Toggling microphone mute: ${microphoneMuted} -> ${newMutedState}`);
    dispatch(setToggleMute(true));
  };

  const handleSpeakerToggle = () => {
    setSpeakerOn((prev) => {
      const newValue = !prev;
      console.log(`[CallAudioControls] Toggling speaker: ${prev} -> ${newValue}`);
      // Сразу устанавливаем громкость при переключении
      if (audioRef.current) {
        audioRef.current.volume = newValue ? 1 : 0.2;
        console.log(`[CallAudioControls] Volume set to: ${audioRef.current.volume}`);
      }
      return newValue;
    });
    // Принудительно включаем звук при клике
    if (audioRef.current && audioEnabled) {
      audioRef.current.play().catch(err => {
        console.warn('Failed to play audio on button click:', err);
      });
    }
  };

  return (
    <div className={cls.container}>
      {/* Иконка вывода звука */}
      <button
        onClick={handleMicrophoneToggle}
        className={cls.microphoneButton}
        title={audioEnabled ? 'Звук включен. Нажми, чтобы выключить.' : 'Звук выключен. Нажми, чтобы включить.'}
        aria-label={audioEnabled ? 'Выключить звук' : 'Включить звук'}
      >
        <span className={cls.microphoneIcon} role="img" aria-hidden="true">
          🔊
        </span>
        {!audioEnabled && (
          <span className={cls.microphoneDisabled}>
            <span className={cls.microphoneDisabledLine}></span>
          </span>
        )}
      </button>

      {/* Иконка микрофона (mute/unmute) */}
      <button
        onClick={handleMicrophoneMuteToggle}
        className={cls.microphoneButton}
        title={microphoneMuted ? 'Микрофон выключен. Нажми, чтобы включить.' : 'Микрофон включен. Нажми, чтобы выключить.'}
        aria-label={microphoneMuted ? 'Включить микрофон' : 'Выключить микрофон'}
      >
        <span className={cls.microphoneIcon} role="img" aria-hidden="true">
          🎙️
        </span>
        {microphoneMuted && (
          <span className={cls.microphoneDisabled}>
            <span className={cls.microphoneDisabledLine}></span>
          </span>
        )}
      </button>

      {/* Кнопка переключения громкой связи (только когда звук включен) */}
      {audioEnabled && mobile && (
        <button
          onClick={handleSpeakerToggle}
          className={cls.speakerButton}
        >
          {speakerOn ? '🔊 Громкая связь' : '🦻 В наушник'}
        </button>
      )}
    </div>
  );
};
