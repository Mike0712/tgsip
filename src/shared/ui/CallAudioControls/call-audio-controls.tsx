'use client';

import React, { useEffect, useRef, useState } from 'react';
import cls from './call-audio-controls.module.css';

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
  const mobile = isMobileDevice();

  useEffect(() => {
    if (audioRef.current) {
      // Управление громкостью: на мобильных переключаем между 1 (громкая) и 0.2 (наушник)
      // На десктопе всегда громкость 1
      const targetVolume = mobile ? (speakerOn ? 1 : 0.2) : 1;
      
      // Устанавливаем громкость с небольшой задержкой, чтобы убедиться что элемент готов
      const timer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = targetVolume;
          audioRef.current.muted = !audioEnabled;
          
          console.log(`[CallAudioControls] Volume set: ${audioRef.current.volume}, speakerOn: ${speakerOn}, mobile: ${mobile}, muted: ${!audioEnabled}`);
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
    setAudioEnabled(newAudioEnabled);
    
    if (audioRef.current) {
      audioRef.current.muted = !newAudioEnabled;
      
      if (newAudioEnabled) {
        // При включении звука пытаемся его воспроизвести
        audioRef.current.play().catch(err => {
          console.warn('Failed to play audio on microphone toggle:', err);
        });
      }
    }
  };

  const handleSpeakerToggle = () => {
    setSpeakerOn((prev) => {
      const newValue = !prev;
      console.log(`[CallAudioControls] Toggling speaker: ${prev} -> ${newValue}`);
      // Сразу устанавливаем громкость при переключении (только на мобильных)
      if (audioRef.current && mobile) {
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
      {/* Иконка микрофона */}
      <button
        onClick={handleMicrophoneToggle}
        className={cls.microphoneButton}
        title={audioEnabled ? 'Звук включен. Нажми, чтобы выключить.' : 'Звук выключен. Нажми, чтобы включить.'}
        aria-label={audioEnabled ? 'Выключить звук' : 'Включить звук'}
      >
        <span className={cls.microphoneIcon} role="img" aria-hidden="true">
          🎙️
        </span>
        {!audioEnabled && (
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
