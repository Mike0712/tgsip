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
      // Управление громкостью (1 — громкая, 0.2 — "наушник")
      audioRef.current.volume = speakerOn ? 1 : 0.2;
      audioRef.current.muted = !audioEnabled;
      
      // Пытаемся включить звук при изменении режима (для мобильных)
      if (mobile && audioEnabled && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.warn('Failed to play audio on speaker toggle:', err);
        });
      }
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
    setSpeakerOn((prev) => !prev);
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
