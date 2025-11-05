import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { apiClient } from '@/lib/api';
import {
  setCallMode,
  setInviteToken,
  setActiveInvite,
  setInviteLink,
  setInviteStatus,
  setCallPartner,
  resetInvite
} from '@/entities/WebRtc/model/slice';
import { getSipServiceInstance } from '@/entities/WebRtc/services/sipServiceInstance';
import { useAlert } from '@/shared/lib/hooks/useAlert';

const InviteManager = () => {
  const dispatch = useDispatch();
  const { showAlert } = useAlert();
  const inviteStatus = useSelector((state: RootState) => state.sip.inviteStatus);
  const inviteLink = useSelector((state: RootState) => state.sip.inviteLink);
  const activeInvite = useSelector((state: RootState) => state.sip.activeInvite);
  const callPartner = useSelector((state: RootState) => state.sip.callPartner);
  const selectedAccount = useSelector((state: RootState) => state.sip.selectedAccount);
  const [error, setError] = useState<string | null>(null);

  // Polling для проверки статуса invite
  useEffect(() => {
    if (!activeInvite?.token || inviteStatus !== 'active') return;

    const checkInviteStatus = async () => {
      try {
        const response = await apiClient.getInviteInfo(activeInvite.token);
        
        if (response.success && response.data) {
          const invite = response.data.invite;
          
          // Если invite завершен или истек
          if (invite.status === 'completed' || invite.status === 'expired') {
            dispatch(resetInvite());
            return;
          }

          // Проверяем готовность к звонку через joinInvite
          const joinResponse = await apiClient.joinInvite(activeInvite.token);
          
          if (joinResponse.success && joinResponse.data) {
            const { partner_sip_username, ready_to_call } = joinResponse.data;
            
            if (partner_sip_username && !callPartner) {
              dispatch(setCallPartner({
                sip_username: partner_sip_username,
                telegram_id: invite.creator_telegram_id
              }));
            }

            if (ready_to_call && inviteStatus !== 'ready') {
              dispatch(setInviteStatus('ready'));
            }
          }
        }
      } catch (err) {
        console.error('Failed to check invite status:', err);
      }
    };

    const interval = setInterval(checkInviteStatus, 2000); // Проверяем каждые 2 секунды
    return () => clearInterval(interval);
  }, [activeInvite?.token, inviteStatus, callPartner, dispatch]);

  // Автоматический звонок когда оба участника готовы (для создателя)
  useEffect(() => {
    if (
      inviteStatus === 'ready' &&
      callPartner &&
      selectedAccount &&
      callPartner.sip_username
    ) {
      initiateCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteStatus, callPartner?.sip_username, selectedAccount?.id]);

  const initiateCall = async () => {
    if (!callPartner?.sip_username || !selectedAccount) return;

    try {
      dispatch(setInviteStatus('connecting'));
      
      const sipService = getSipServiceInstance();
      if (!sipService) {
        throw new Error('SIP service not initialized');
      }

      const stateListener = (state: string) => {
        dispatch(setInviteStatus(state === 'Established' ? 'active' : 'connecting'));
      };

      await sipService.makeCallToSipAccount(callPartner.sip_username, stateListener);
    } catch (err) {
      console.error('Failed to initiate call:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate call');
    }
  };

  const createInvite = async () => {
    try {
      dispatch(setInviteStatus('creating'));
      setError(null);

      const response = await apiClient.createInviteLink();
      
      if (response.success && response.data) {
        const invite = response.data;
        const link = `${window.location.origin}/miniphone?invite=${invite.token}`;
        
        dispatch(setCallMode('invite'));
        dispatch(setInviteToken(invite.token));
        dispatch(setActiveInvite(invite));
        dispatch(setInviteLink(link));
        dispatch(setInviteStatus('active'));
      } else {
        setError(response.error || 'Не удалось создать приглашение');
        dispatch(setInviteStatus('idle'));
      }
    } catch (err) {
      setError('Ошибка при создании приглашения');
      dispatch(setInviteStatus('idle'));
      console.error('Failed to create invite:', err);
    }
  };

  const cancelInvite = async () => {
    if (!activeInvite?.token) return;

    try {
      await apiClient.cancelInvite(activeInvite.token);
      dispatch(resetInvite());
      setError(null);
    } catch (err) {
      console.error('Failed to cancel invite:', err);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        showAlert('Ссылка скопирована', 'Ссылка скопирована в буфер обмена', 'success');
      }).catch(() => {
        showAlert('Ошибка', 'Не удалось скопировать ссылку', 'error');
      });
    }
  };

  if (inviteStatus === 'idle') {
    return (
      <div className="mb-6">
        <button
          onClick={createInvite}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          📞 Создать приглашение
        </button>
      </div>
    );
  }

  if (inviteStatus === 'creating') {
    return (
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-blue-700">Создание приглашения...</span>
        </div>
      </div>
    );
  }

  if (inviteStatus === 'active' || inviteStatus === 'waiting') {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Приглашение создано</h3>
          <button
            onClick={cancelInvite}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
          >
            Отменить
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ссылка для приглашения:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink || ''}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
            <span className="text-blue-700 text-sm">
              Ожидание подключения второго участника...
            </span>
          </div>
        </div>

        {callPartner && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-green-700 text-sm">
              ✅ Участник подключен: {callPartner.sip_username}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default InviteManager;

