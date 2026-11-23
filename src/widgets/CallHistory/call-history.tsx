'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { apiClient, CallHistoryEntry } from '@/lib/api';

// Same presentation as the mobile app's CallHistoryScreen.

const DIRECTION_ARROW: Record<CallHistoryEntry['direction'], string> = {
  incoming: '↙',
  outgoing: '↗',
};

const statusLabel = (call: CallHistoryEntry): string => {
  if (call.status === 'ringing') return 'Звонит…';
  if (call.status === 'failed') return 'Не удался';
  if (call.status === 'missed') return call.direction === 'incoming' ? 'Пропущенный' : 'Не отвечен';
  return call.direction === 'incoming' ? 'Входящий' : 'Исходящий';
};

const formatDuration = (seconds: number | null): string | null => {
  if (seconds === null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  const day = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  return `${day} ${time}`;
};

// The client reports "ended" to the API asynchronously after hangup — give it a moment.
const RELOAD_AFTER_CALL_MS = 1500;

interface CallHistoryProps {
  /** Tapped row's number — the parent switches to the dialer with it pre-filled. */
  onSelectNumber?: (number: string) => void;
  /** "←" button: back to the dialer. */
  onBack?: () => void;
}

const CallHistory: React.FC<CallHistoryProps> = ({ onSelectNumber, onBack }) => {
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const prevSessionState = useRef(sessionState);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiClient.getCallHistory();
    if (res.success && res.data?.calls) {
      setCalls(res.data.calls);
    } else {
      setError(res.error || res.data?.error || 'Не удалось загрузить историю звонков');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // A call (e.g. incoming, answered while this tab was open) just ended — refresh.
  useEffect(() => {
    const prev = prevSessionState.current;
    prevSessionState.current = sessionState;
    if (sessionState !== 'Terminated' || prev === 'Terminated') return;
    const timer = setTimeout(() => load(), RELOAD_AFTER_CALL_MS);
    return () => clearTimeout(timer);
  }, [sessionState, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 rounded-md px-2 py-1 text-xl leading-none text-gray-700 hover:bg-gray-100"
            aria-label="Назад к набору номера"
          >
            ←
          </button>
        )}
        <h2 className="flex-1 text-lg font-semibold text-gray-800">История звонков</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          aria-label="Обновить"
        >
          {refreshing ? '…' : '⟳ Обновить'}
        </button>
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-6">Загрузка…</p>}
      {error && <p className="text-center text-sm text-red-600 mb-3">{error}</p>}
      {!loading && !error && calls.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-6">Звонков пока нет</p>
      )}

      <ul className="space-y-2">
        {calls.map((call) => {
          const duration = formatDuration(call.duration_seconds);
          const missed = call.status !== 'answered';
          return (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => onSelectNumber?.(call.remote_number)}
                className="w-full flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <span className={`text-lg ${missed ? 'text-red-500' : 'text-green-600'}`} aria-hidden>
                  {DIRECTION_ARROW[call.direction]}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-base font-medium text-gray-900">{call.remote_number}</span>
                  <span className="block text-xs text-gray-500">
                    {statusLabel(call)}
                    {duration ? ` · ${duration}` : ''}
                    {call.local_number ? ` · ${call.direction === 'incoming' ? 'на' : 'с'} ${call.local_number}` : ''}
                  </span>
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(call.started_at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CallHistory;
