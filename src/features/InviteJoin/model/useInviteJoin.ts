import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  setSipAccounts,
  setSelectedAccount,
  setCallMode,
  setInviteToken,
  setInviteStatus,
  setCallPartner,
} from '@/entities/WebRtc/model/slice';
import store from '@/app/store';

interface UseInviteJoinReturn {
  joinInvite: (token: string) => Promise<void>;
}

export const useInviteJoin = (
  isAuthenticated: boolean,
  user: { telegram_id: string } | null,
  sipAccounts: any[]
): UseInviteJoinReturn => {
  const joinInvite = useCallback(async (token: string) => {
    try {
      store.dispatch(setInviteToken(token));
      store.dispatch(setCallMode('invite'));
      store.dispatch(setInviteStatus('connecting'));

      if (!isAuthenticated || !user) {
        localStorage.setItem('pending_invite', token);
        return;
      }

      let sipAccount = sipAccounts.length > 0 ? sipAccounts[0] : null;
      
      if (!sipAccount) {
        console.log('📞 User has no SIP account, requesting...');
        const addUserResponse = await apiClient.addUser();
        
        if (addUserResponse.success && addUserResponse.data) {
          sipAccount = addUserResponse.data;
          store.dispatch(setSipAccounts([sipAccount]));
          store.dispatch(setSelectedAccount(sipAccount));
          
          const accountsResponse = await apiClient.getSipAccounts();
          if (accountsResponse.success && accountsResponse.data) {
            const accounts = (accountsResponse.data as any).accounts || [];
            store.dispatch(setSipAccounts(accounts));
            const activeAccount = accounts.find((acc: any) => acc.is_active);
            if (activeAccount) {
              store.dispatch(setSelectedAccount(activeAccount));
            }
          }
        } else {
          throw new Error(addUserResponse.error || 'Failed to get SIP account');
        }
      }

      const joinResponse = await apiClient.joinInvite(token);
      
      if (joinResponse.success && joinResponse.data) {
        const { partner_sip_username, ready_to_call } = joinResponse.data;
        
        if (partner_sip_username) {
          store.dispatch(setCallPartner({
            sip_username: partner_sip_username,
            telegram_id: joinResponse.data.invite.creator_telegram_id
          }));
        }

        if (ready_to_call) {
          store.dispatch(setInviteStatus('ready'));
        } else {
          store.dispatch(setInviteStatus('waiting'));
        }
      } else {
        throw new Error(joinResponse.error || 'Failed to join invite');
      }
    } catch (err) {
      console.error('Failed to join invite:', err);
      store.dispatch(setInviteStatus('idle'));
    }
  }, [isAuthenticated, user, sipAccounts]);

  return {
    joinInvite,
  };
};

