'use client';

import React, { useEffect, useRef } from 'react';
import store from '@/app/store';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile|ios|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

interface WakeLockManagerProps {
  isActive: boolean; // true когда нужно держать экран активным (например, во время звонка)
}

export const WakeLockManager: React.FC<WakeLockManagerProps> = ({ isActive }) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const releaseHandlerRef = useRef<(() => void) | null>(null);
  const mobile = isMobileDevice();

  useEffect(() => {
    // Wake Lock работает только на мобильных устройствах
    if (!mobile) {
      return;
    }

    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      console.warn('⚠️ Wake Lock API not supported - screen may sleep during calls');
      return;
    }

    const requestWakeLock = async () => {
      try {
        // Если уже есть активный wake lock, сначала освобождаем его
        if (wakeLockRef.current) {
          if (releaseHandlerRef.current) {
            wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
          }
          await wakeLockRef.current.release().catch(() => {});
        }

        const wakeLock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = wakeLock;
        console.log('🔒 Wake Lock activated - screen will stay awake');
        
        // КРИТИЧНО: если wake lock освобождается во время активной сессии - перезапрашиваем его
        const releaseHandler = () => {
          console.warn('⚠️ Wake Lock released - checking if still needed...');
          // Проверяем актуальное состояние через небольшую задержку
          setTimeout(() => {
            // Используем store напрямую для получения актуального состояния
            const currentState = store.getState().sip.sessionState;
            if (currentState === 'Established') {
              console.log('🔄 Session still active - re-requesting Wake Lock...');
              requestWakeLock().catch(err => {
                console.error('❌ Failed to re-request Wake Lock:', err);
              });
            } else {
              console.log('✅ Session ended - Wake Lock not needed');
            }
          }, 100);
        };
        
        releaseHandlerRef.current = releaseHandler;
        wakeLock.addEventListener('release', releaseHandler);
      } catch (error) {
        console.error('❌ Wake Lock request failed:', error);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          if (releaseHandlerRef.current) {
            wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
            releaseHandlerRef.current = null;
          }
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('🔓 Wake Lock released - screen can sleep now');
        } catch (error) {
          console.warn('⚠️ Wake Lock release failed:', error);
        }
      }
    };

    if (isActive) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isActive, mobile]);

  return null; // Компонент не рендерит ничего
};
