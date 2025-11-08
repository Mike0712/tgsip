'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  apiClient,
  BridgeParticipant,
  BridgeSession,
  CallSessionRecord,
} from '@/lib/api';
import { RootState, AppDispatch } from '@/app/store';
import {
  setBridgeStatus,
  setBridgeSession,
  setBridgeParticipants,
  resetBridge,
} from '@/entities/WebRtc/model/slice';

interface StartBridgeOptions {
  target?: string;
  metadata?: Record<string, unknown>;
}

const mapSessionStatus = (status: CallSessionRecord['status']): RootState['sip']['bridgeStatus'] => {
  switch (status) {
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'terminated':
      return 'completed';
    default:
      return 'creating';
  }
};

interface UseBridgeDialerResult {
  bridgeSession: BridgeSession | null;
  bridgeParticipants: BridgeParticipant[];
  bridgeStatus: RootState['sip']['bridgeStatus'];
  isProcessing: boolean;
  error: string | null;
  startBridge: (options: StartBridgeOptions) => Promise<void>;
  addParticipant: (participant: { channel: string; role?: string; userId: number }) => Promise<void>;
  endBridge: () => Promise<void>;
  resetBridgeState: () => void;
  loadSession: (bridgeId: string) => Promise<boolean>;
}

export const useBridgeDialer = (): UseBridgeDialerResult => {
  const dispatch = useDispatch<AppDispatch>();
  const bridgeSession = useSelector((state: RootState) => state.sip.bridgeSession);
  const bridgeParticipants = useSelector((state: RootState) => state.sip.bridgeParticipants);
  const bridgeStatus = useSelector((state: RootState) => state.sip.bridgeStatus);

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startBridge = useCallback(async (options: StartBridgeOptions) => {
    setIsProcessing(true);
    setError(null);
    dispatch(setBridgeStatus('creating'));

    try {
      const response = await apiClient.createBridgeSession({
        target: options.target,
        metadata: options.metadata,
      });

      if (!response.success || !response.data?.bridge) {
        throw new Error(response.error || 'Не удалось создать сессию');
      }

      dispatch(setBridgeSession(response.data.bridge));
      dispatch(setBridgeParticipants(response.data.participants ?? []));
      dispatch(setBridgeStatus('active'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при создании сессии';
      setError(message);
      dispatch(setBridgeStatus('failed'));
    } finally {
      setIsProcessing(false);
    }
  }, [dispatch]);

  const addParticipant = useCallback(async (participant: { channel: string; role?: string; userId: number }) => {
    if (!bridgeSession) {
      setError('Нет активной сессии');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiClient.addBridgeParticipant(bridgeSession.id, participant);

      if (!response.success) {
        throw new Error(response.error || 'Не удалось добавить участника');
      }

      if (response.data?.participants) {
        dispatch(setBridgeParticipants(response.data.participants));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при добавлении участника';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [bridgeSession, dispatch]);

  const endBridge = useCallback(async () => {
    if (!bridgeSession) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    dispatch(setBridgeStatus('terminating'));

    try {
      const response = await apiClient.endBridgeSession(bridgeSession.id);

      if (!response.success) {
        throw new Error(response.error || 'Не удалось завершить сессию');
      }

      dispatch(resetBridge());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при завершении сессии';
      setError(message);
      dispatch(setBridgeStatus('failed'));
    } finally {
      setIsProcessing(false);
    }
  }, [bridgeSession, dispatch]);

  const resetBridgeState = useCallback(() => {
    dispatch(resetBridge());
    setError(null);
    setIsProcessing(false);
  }, [dispatch]);

  const loadSession = useCallback(async (bridgeId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const storedSession = await apiClient.getStoredCallSession(bridgeId);

      if (!storedSession.success || !storedSession.data?.session) {
        throw new Error(storedSession.error || 'Не удалось найти сессию');
      }

      const bridgeResponse = await apiClient.getBridgeSession(bridgeId);

      if (!bridgeResponse.success || !bridgeResponse.data?.bridge) {
        throw new Error(bridgeResponse.error || 'Не удалось получить данные моста');
      }

      dispatch(setBridgeSession(bridgeResponse.data.bridge));
      dispatch(setBridgeStatus(mapSessionStatus(storedSession.data.session.status)));
      dispatch(setBridgeParticipants([]));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при загрузке сессии';
      setError(message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [dispatch]);

  return useMemo(() => ({
    bridgeSession,
    bridgeParticipants,
    bridgeStatus,
    isProcessing,
    error,
    startBridge,
    addParticipant,
    endBridge,
    resetBridgeState,
    loadSession,
  }), [
    addParticipant,
    bridgeParticipants,
    bridgeSession,
    bridgeStatus,
    endBridge,
    error,
    isProcessing,
    loadSession,
    resetBridgeState,
    startBridge,
  ]);
};

