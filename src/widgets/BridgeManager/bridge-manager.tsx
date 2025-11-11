'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { useBridgeDialer } from '@/features/BridgeDialer/model/useBridgeDialer';
import { useAlert } from '@/shared/lib/hooks/useAlert';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
import { getSipServiceInstance } from '@/entities/WebRtc/services/sipServiceInstance';

const formatStatus = (status: ReturnType<typeof useBridgeDialer>['bridgeStatus']) => {
  switch (status) {
    case 'creating':
      return 'Создаём сессию...';
    case 'active':
      return 'Сессия активна';
    case 'terminating':
      return 'Завершаем сессию...';
    case 'completed':
      return 'Сессия завершена';
    case 'failed':
      return 'Ошибка сессии';
    default:
      return 'Сессия не создана';
  }
};

const BridgeManager: React.FC = () => {
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const {
    bridgeSession,
    bridgeParticipants,
    bridgeStatus,
    isProcessing,
    error,
    startBridge,
    endBridge,
    resetBridgeState,
    loadSession,
  } = useBridgeDialer();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const bridgeParam = searchParams?.get('bridge');
  const hasLoadedFromLink = useRef<string | null>(null);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  const deepLink = useMemo(() => {
    if (!bridgeSession || !botUsername) return null;
    return `https://t.me/${botUsername}?start=${bridgeSession.id}`;
  }, [bridgeSession, botUsername]);

  const appLink = useMemo(() => {
    if (!bridgeSession || process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/miniphone?bridge=${bridgeSession.id}`;
  }, [bridgeSession]);

  const handleCreate = async () => {
    await startBridge({
      metadata: {
        origin: 'miniphone',
        created_at: new Date().toISOString(),
      },
    });
  };

  const handleJoin = async () => {
    if (!bridgeSession?.id) {
      showAlert('Нет активной сессии', 'Создай сессию или обнови страницу.', 'warning');
      return;
    }

    if (!selectedAccount?.sip_username) {
      showAlert('Нет SIP аккаунта', 'Выбери или подключи SIP аккаунт и попробуй снова.', 'warning');
      return;
    }

    const sipService = getSipServiceInstance();
    if (!sipService) {
      showAlert('SIP недоступен', 'Переподключи SIP перед присоединением.', 'warning');
      return;
    }

    const storedMeta = bridgeSession.metadata && typeof bridgeSession.metadata === 'object'
      ? (bridgeSession.metadata as Record<string, unknown>)
      : {};

    const dialTarget =
      (bridgeSession as any).join_extension ||
      (storedMeta.join_extension as string) ||
      (storedMeta.target as string) ||
      bridgeSession.id.replace(/[^0-9A-Za-z]/g, '');

    if (!dialTarget) {
      showAlert('Нет маршрута', 'Для этой сессии не задано направление звонка.', 'warning');
      return;
    }

    try {
      await sipService.makeCall(
        dialTarget,
        () => {},
        selectedAccount.sip_username,
      );
      showAlert('Звонок инициирован', `Подключение к сессии через ${dialTarget}`, 'success');
    } catch (error) {
      console.error('Failed to dial bridge extension:', error);
      showAlert('Ошибка звонка', 'Не удалось инициировать звонок. Попробуй ещё раз.', 'error');
    }
  };

  useEffect(() => {
    if (!bridgeParam) {
      return;
    }

    if (bridgeSession && bridgeSession.id === bridgeParam) {
      return;
    }

    if (hasLoadedFromLink.current === bridgeParam) {
      return;
    }

    loadSession(bridgeParam).then((success) => {
      if (success) {
        hasLoadedFromLink.current = bridgeParam;
      }
    });
  }, [bridgeParam, bridgeSession, loadSession]);

  const handleEnd = async () => {
    await endBridge();
  };

  const handleReset = () => {
    resetBridgeState();
  };

  const handleCopy = (value: string, message: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      showAlert('Ссылка скопирована', message, 'success');
    }).catch(() => {
      showAlert('Ошибка', 'Не удалось скопировать ссылку', 'error');
    });
  };

  const renderShareBlock = () => (
    <>
      {deepLink && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ссылка для Telegram бота:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={deepLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={() => handleCopy(deepLink, 'Deep link скопирован в буфер обмена')}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>
      )}

      {appLink && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Прямая ссылка на MiniPhone:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={appLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={() => handleCopy(appLink, 'Ссылка на MiniPhone скопирована')}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {formatStatus(bridgeStatus)}
          </span>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {!bridgeSession && (
        <button
          onClick={handleCreate}
          disabled={isProcessing || bridgeStatus === 'creating'}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${isProcessing || bridgeStatus === 'creating'
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          Создать созвон
        </button>
      )}

      {bridgeSession && (
        <>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium">ID сессии</span>
              <code className="text-xs text-gray-500">{bridgeSession.id}</code>
            </div>
            {bridgeSession.target && (
              <p className="mt-2 text-xs text-gray-500">Target: {bridgeSession.target}</p>
            )}
          </div>

          {renderShareBlock()}

          <div className="space-y-2">
            <button
              onClick={handleJoin}
              disabled={isProcessing || ['terminating', 'completed', 'failed'].includes(bridgeStatus)}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isProcessing || ['terminating', 'completed', 'failed'].includes(bridgeStatus)
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
              Присоединиться к сессии
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleEnd}
                disabled={isProcessing || bridgeStatus === 'terminating'}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isProcessing || bridgeStatus === 'terminating'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
              >
                Завершить сессию
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Сбросить
              </button>
            </div>
          </div>

          {bridgeParticipants.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Участники</h4>
              <ul className="space-y-2">
                {bridgeParticipants.map((participant) => (
                  <li
                    key={participant.id}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 flex justify-between"
                  >
                    <span>{participant.display_name || participant.reference}</span>
                    <span>{participant.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BridgeManager;

