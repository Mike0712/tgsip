import React from 'react';
import cls from './dtmf-pad.module.css';

interface DtmfPadProps {
  onDigit: (digit: string) => void;
  disabled?: boolean;
}

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

// DTMF частоты
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
};

const playDtmfTone = (digit: string) => {
  const frequencies = DTMF_FREQUENCIES[digit];
  if (!frequencies) return;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator1 = audioContext.createOscillator();
  const oscillator2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator1.frequency.value = frequencies[0];
  oscillator2.frequency.value = frequencies[1];
  oscillator1.type = 'sine';
  oscillator2.type = 'sine';

  gainNode.gain.value = 0.3;

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator1.start();
  oscillator2.start();

  setTimeout(() => {
    oscillator1.stop();
    oscillator2.stop();
    audioContext.close();
  }, 150);
};

const DtmfPad: React.FC<DtmfPadProps> = ({ onDigit, disabled = false }) => {
  const handleDigit = (digit: string) => {
    playDtmfTone(digit);
    onDigit(digit);
  };

  return (
    <div className={cls.dtmfPad}>
      {DTMF_KEYS.map((row, rowIndex) => (
        <div key={rowIndex} className={cls.row}>
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              disabled={disabled}
              className={cls.key}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default DtmfPad;