'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient, BridgeParticipant, BridgeSession } from '@/lib/api';
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

interface UseBridgeDialerResult {
  bridgeSession: BridgeSession | null;
  bridgeParticipants: BridgeParticipant[];
  bridgeStatus: RootState['sip']['bridgeStatus'];
  isProcessing: boolean;
  error: string | null;
  startBridge: (options: StartBridgeOptions) => Promise<void>;
  addParticipant: (participant: {
    type: BridgeParticipant['type'];
    role: BridgeParticipant['role'];
    reference: string;
    display_name?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  endBridge: () => Promise<void>;
  resetBridgeState: () => void;
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

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Не удалось создать сессию');
      }

      dispatch(setBridgeSession(response.data.bridge));
      dispatch(setBridgeParticipants(response.data.participants));
      dispatch(setBridgeStatus('active'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при создании сессии';
      setError(message);
      dispatch(setBridgeStatus('failed'));
    } finally {
      setIsProcessing(false);
    }
  }, [dispatch]);

  const addParticipant = useCallback(async (participant: {
    type: BridgeParticipant['type'];
    role: BridgeParticipant['role'];
    reference: string;
    display_name?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!bridgeSession) {
      setError('Нет активной сессии');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiClient.addBridgeParticipant(bridgeSession.id, participant);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Не удалось добавить участника');
      }

      dispatch(setBridgeParticipants(response.data.participants));
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

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Не удалось завершить сессию');
      }

      dispatch(setBridgeSession(response.data.bridge));
      dispatch(setBridgeStatus('completed'));
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
  }), [
    addParticipant,
    bridgeParticipants,
    bridgeSession,
    bridgeStatus,
    endBridge,
    error,
    isProcessing,
    resetBridgeState,
    startBridge,
  ]);
};

