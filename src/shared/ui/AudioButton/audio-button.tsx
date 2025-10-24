import React, { useState, useEffect } from 'react';

const AudioButton = () => {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Слушаем событие ошибки воспроизведения
    const handlePlayError = () => {
      setAudioBlocked(true);
      setHidden(false);
    };

    window.addEventListener('audio-play-failed', handlePlayError);
    return () => window.removeEventListener('audio-play-failed', handlePlayError);
  }, []);

  const handleUnblock = () => {
    const mediaElement = document.getElementById('mediaElement') as HTMLAudioElement;
    if (mediaElement) {
      mediaElement.play()
        .then(() => {
          console.log('✅ Audio unblocked by user interaction');
          setAudioBlocked(false);
          setHidden(true);
        })
        .catch(err => console.error('Still blocked:', err));
    }
  };

  if (hidden || !audioBlocked) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <button
        onClick={handleUnblock}
        className="px-6 py-3 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 animate-pulse"
      >
        🔊 Включить звук
      </button>
    </div>
  );
};

export default AudioButton;
