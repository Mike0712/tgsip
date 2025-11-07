import React, { useState, useEffect } from "react";
import { useSelector } from 'react-redux';
import Handset from '@/shared/ui/Handset/handset-telegram';
import { RootState } from "@/app/store";
import { useBridgeDialer } from '@/features/BridgeDialer/model/useBridgeDialer';

const DialerTelegram = () => {
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const invite = useSelector((state: RootState) => state.sip.invite);
  const userPhones = useSelector((state: RootState) => state.sip.userPhones);
  const bridgeStatus = useSelector((state: RootState) => state.sip.bridgeStatus);
  const bridgeSession = useSelector((state: RootState) => state.sip.bridgeSession);
  const bridgeParticipants = useSelector((state: RootState) => state.sip.bridgeParticipants);
  const [isClient, setIsClient] = useState(false);
  const {
    startBridge,
    endBridge,
    isProcessing,
    error,
  } = useBridgeDialer();

  // Предотвращаем ошибку гидратации
  useEffect(() => {
    setIsClient(true);
  }, []);

  const onCall = (dialingNumber: string) => {
    startBridge({
      target: dialingNumber,
      metadata: {
        source: 'manual-dialer',
        initiated_at: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
      <Handset
        onCall={onCall}
        sessionState={sessionState}
        invite={invite}
        userPhones={userPhones}
      />

      {(bridgeSession || bridgeStatus !== 'idle') && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">Сессия звонка</span>
            {bridgeSession && (
              <span className="text-xs text-gray-500">ID: {bridgeSession.id.slice(0, 8)}…</span>
            )}
          </div>
          <div className="text-xs text-gray-600 mb-2">
            Статус: {
              bridgeStatus === 'creating' ? 'Создаём' :
              bridgeStatus === 'active' ? 'Активна' :
              bridgeStatus === 'terminating' ? 'Завершаем' :
              bridgeStatus === 'completed' ? 'Завершена' :
              bridgeStatus === 'failed' ? 'Ошибка' :
              'Ожидание'
            }
          </div>
          {bridgeParticipants.length > 0 && (
            <ul className="space-y-1">
              {bridgeParticipants.map((participant) => (
                <li key={participant.id} className="flex items-center justify-between text-xs text-gray-600">
                  <span>{participant.display_name || participant.reference}</span>
                  <span className="text-gray-400">{participant.status}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => endBridge()}
              disabled={!bridgeSession || bridgeStatus === 'terminating' || bridgeStatus === 'completed'}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                !bridgeSession || bridgeStatus === 'terminating' || bridgeStatus === 'completed'
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Завершить сессию
            </button>
            {isProcessing && (
              <span className="text-xs text-gray-500 self-center">Выполняем…</span>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default DialerTelegram;
