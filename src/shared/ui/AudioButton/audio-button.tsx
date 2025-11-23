import React, { useEffect, useState } from 'react';

const AudioButton = () => {
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const handlePlayError = () => setBlocked(true);
    window.addEventListener('audio-play-failed', handlePlayError);
    return () => window.removeEventListener('audio-play-failed', handlePlayError);
  }, []);

  useEffect(() => {
    const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
    if (!mediaElement) return;

    mediaElement.muted = muted;
    mediaElement.volume = muted ? 0 : 1;
  }, [muted]);

  const handleClick = () => {
    const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
    if (!mediaElement) {
      return;
    }

    if (blocked) {
      mediaElement
        .play()
        .then(() => {
          setBlocked(false);
          setMuted(false);
        })
        .catch((err) => {
          console.error('Unable to unlock audio:', err);
          setBlocked(true);
        });
      return;
    }

    if (muted) {
      mediaElement
        .play()
        .then(() => {
          setMuted(false);
        })
        .catch((err) => {
          console.error('Unable to play audio:', err);
          setBlocked(true);
        });
    } else {
      setMuted(true);
    }
  };

  const isMuted = blocked || muted;

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={handleClick}
        className={`relative inline-flex items-center justify-center w-14 h-14 rounded-full shadow transition-colors ${
          isMuted ? 'bg-red-600 text-white' : 'bg-green-500 text-white'
        }`}
        title={isMuted ? 'Звук выключен. Нажми, чтобы включить.' : 'Звук включён. Нажми, чтобы выключить.'}
        aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
      >
        <span className="text-2xl" role="img" aria-hidden="true">
          🎙️
        </span>
        {isMuted && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="block w-12 h-0.5 bg-gray-300 rotate-45"></span>
          </span>
        )}
      </button>
    </div>
  );
};

export default AudioButton;
