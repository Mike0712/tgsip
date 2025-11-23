import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { apiClient, UserSummary } from '@/lib/api';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [invitedUser, setInvitedUser] = useState<UserSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTouched, setSearchTouched] = useState(false);
  const [botDeepLink, setBotDeepLink] = useState<string | null>(null);
  const skipNextSearch = useRef(false);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const baseBotLink = botUsername ? `https://t.me/${botUsername}` : null;

  const buildUserLabel = (user: UserSummary) => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return fullName || user.username || user.telegram_id;
  };

  const buildUserMeta = (user: UserSummary) => {
    const parts: string[] = [];
    if (user.username) {
      parts.push(`@${user.username}`);
    }
    parts.push(`ID: ${user.telegram_id}`);
    return parts.join(' • ');
  };

  useEffect(() => {
    const trimmed = searchTerm.trim();

    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      setIsSearching(false);
      return;
    }

    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(searchTouched ? 'Введи минимум 2 символа' : null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await apiClient.searchUsers(trimmed, 8);
        if (cancelled) return;

        if (response.success && response.data) {
          setSearchResults(response.data.users);
          if (!response.data.users.length) {
            setSearchError('Ничего не нашли');
          }
        } else {
          setSearchResults([]);
          setSearchError(response.error || 'Не удалось найти пользователей');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to search users:', err);
        setSearchResults([]);
        setSearchError('Ошибка при поиске пользователей');
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm, searchTouched]);

  // Polling для проверки статуса invite
  useEffect(() => {
    if (!activeInvite?.token || (inviteStatus !== 'active' && inviteStatus !== 'waiting')) return;

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

            if (ready_to_call) {
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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTouched(true);
    setSearchTerm(value);
    setSelectedUser(null);
    if (!value.trim()) {
      setSearchError(null);
    }
  };

  const handleSelectUser = (user: UserSummary) => {
    setSelectedUser(user);
    setInvitedUser(null);
    setSearchTerm(buildUserLabel(user));
    setSearchResults([]);
    setSearchError(null);
    skipNextSearch.current = true;
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setInvitedUser(null);
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setSearchTouched(false);
    skipNextSearch.current = false;
  };

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
    if (!selectedUser) {
      setError('Выбери Telegram аккаунт перед созданием приглашения');
      return;
    }

    let createdToken: string | null = null;

    try {
      dispatch(setInviteStatus('creating'));
      setError(null);

      const response = await apiClient.createInviteLink();

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Не удалось создать приглашение');
      }

      const invite = response.data;
      createdToken = invite.token;

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || '';
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const link = `${normalizedBase}/miniphone?invite=${invite.token}`;

      if (botUsername) {
        setBotDeepLink(`https://t.me/${botUsername}?startapp=${invite.token}`);
      }

      const sendResponse = await apiClient.sendInviteMessage({
        telegram_id: selectedUser.telegram_id,
        link,
      });

      if (!sendResponse.success) {
        throw new Error(sendResponse.error || 'Не удалось отправить приглашение в Telegram');
      }

      setInvitedUser(selectedUser);
      dispatch(setCallMode('invite'));
      dispatch(setInviteToken(invite.token));
      dispatch(setActiveInvite(invite));
      dispatch(setInviteLink(link));
      dispatch(setInviteStatus('waiting'));
      showAlert('Приглашение отправлено', 'Мы отправили ссылку выбранному Telegram аккаунту', 'success');
    } catch (err) {
      if (createdToken) {
        try {
          await apiClient.cancelInvite(createdToken);
        } catch (cancelError) {
          console.error('Failed to rollback invite:', cancelError);
        }
      }

      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании приглашения';
      setError(errorMessage);
      dispatch(setInviteStatus('idle'));
      setBotDeepLink(null);
      console.error('Failed to create invite:', err);
    }
  };

  const cancelInvite = async () => {
    if (!activeInvite?.token) {
      dispatch(resetInvite());
      setInvitedUser(null);
      return;
    }

    try {
      await apiClient.cancelInvite(activeInvite.token);
      dispatch(resetInvite());
      setError(null);
      setInvitedUser(null);
      setBotDeepLink(null);
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

  const copyBotDeepLink = () => {
    if (botDeepLink) {
      navigator.clipboard.writeText(botDeepLink).then(() => {
        showAlert('Ссылка скопирована', 'Deep link скопирован в буфер обмена', 'success');
      }).catch(() => {
        showAlert('Ошибка', 'Не удалось скопировать ссылку', 'error');
      });
    }
  };

  const openBotDeepLink = () => {
    if (botDeepLink && typeof window !== 'undefined') {
      window.open(botDeepLink, '_blank', 'noopener,noreferrer');
    }
  };

  const copyBaseBotLink = () => {
    if (!baseBotLink) {
      showAlert('Нужно настроить бота', 'Пропиши NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, чтобы поделиться ссылкой.', 'warning');
      return;
    }

    navigator.clipboard.writeText(baseBotLink).then(() => {
      showAlert('Ссылка скопирована', 'Ссылка на бота скопирована в буфер обмена', 'success');
    }).catch(() => {
      showAlert('Ошибка', 'Не удалось скопировать ссылку', 'error');
    });
  };

  const shouldSuggestBotLink = searchError?.includes('Ничего не нашли');

  if (inviteStatus === 'idle') {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Кому отправляем приглашение?
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setSearchTouched(true)}
              placeholder="Имя, @username или Telegram ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Очистить"
              >
                ✕
              </button>
            )}
            {isSearching && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!!searchResults.length && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {searchResults.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50"
                    >
                      <div className="text-sm font-medium text-gray-800">{buildUserLabel(user)}</div>
                      <div className="text-xs text-gray-500">{buildUserMeta(user)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {searchError && (
            <p className="mt-2 text-xs text-red-600">{searchError}</p>
          )}
          {shouldSuggestBotLink && (
            <div className="mt-3 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-sm text-gray-700">
              <p className="mb-3">
                Похоже, пользователя ещё нет в системе. Вы можете отправить ему ссылку для вступления.
              </p>
              <button
                onClick={copyBaseBotLink}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Скопировать ссылку на бота
              </button>
            </div>
          )}
          {selectedUser && !searchError && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
              <div className="font-medium">Выбрано: {buildUserLabel(selectedUser)}</div>
              <div>{buildUserMeta(selectedUser)}</div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={createInvite}
          disabled={!selectedUser || isSearching}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
            !selectedUser || isSearching
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          🚀 Создать и отправить приглашение
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

        {invitedUser && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
            <div>
              Приглашение отправлено: <span className="font-medium">{buildUserLabel(invitedUser)}</span>
            </div>
            <div className="text-xs text-gray-500">{buildUserMeta(invitedUser)}</div>
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

        {botDeepLink && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Приглашение в Telegram-бота:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={botDeepLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={copyBotDeepLink}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Копировать
              </button>
              <button
                onClick={openBotDeepLink}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Открыть
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Если бот ещё не знаком с пользователем, отправь эту ссылку вручную — он откроет диалог с ботом и получит приглашение.
            </p>
          </div>
        )}

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

