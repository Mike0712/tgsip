import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  SipAccount,
  UserPhone,
  Server,
  Phone,
  UserSipConfig,
  InviteLink,
  BridgeSession,
  BridgeParticipant,
} from '@/lib/api';

interface SipState {
  status: 'online' | 'offline';
  serverUrl: string | null;
  serverPort: number | null;
  sessionState: string;
  manualCall: false | string;
  selectedCallerId: string | null;
  invite: boolean;
  answer: boolean;
  hangup: boolean;
  toggleMute: boolean;
  sipAccounts: SipAccount[];
  selectedAccount: SipAccount | null;
  userPhones: UserPhone[];
  servers: Server[];
  phones: Phone[];
  userSipConfigs: UserSipConfig[];
  selectedServer: Server | null;
  currentCredentials: { username: string; password: string } | null;
  // Invite link states
  callMode: 'manual' | 'invite';
  inviteToken: string | null;
  activeInvite: InviteLink | null;
  inviteLink: string | null;
  inviteStatus: 'idle' | 'creating' | 'active' | 'waiting' | 'connecting' | 'ready';
  callPartner: { sip_username: string; telegram_id: string } | null;
  callStatus: 'idle' | 'waiting' | 'connecting' | 'active';
  bridgeSession: BridgeSession | null;
  bridgeStatus: 'idle' | 'creating' | 'active' | 'terminating' | 'completed' | 'failed';
  bridgeParticipants: BridgeParticipant[];
}

const initialState: SipState = {
  status: 'offline',
  serverUrl: null,
  serverPort: null,
  sessionState: '',
  manualCall: false,
  selectedCallerId: null,
  invite: false,
  answer: false,
  hangup: false,
  toggleMute: false,
  sipAccounts: [],
  selectedAccount: null,
  userPhones: [],
  servers: [],
  phones: [],
  userSipConfigs: [],
  selectedServer: null,
  currentCredentials: null,
  callMode: 'manual',
  inviteToken: null,
  activeInvite: null,
  inviteLink: null,
  inviteStatus: 'idle',
  callPartner: null,
  callStatus: 'idle',
  bridgeSession: null,
  bridgeStatus: 'idle',
  bridgeParticipants: [],
};

const sipSlice = createSlice({
  name: 'sip',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<'online' | 'offline'>) => {
      state.status = action.payload;
    },
    setServerUrl: (state, action: PayloadAction<string>) => {
      state.serverUrl = action.payload;
    },
    setServerPort: (state, action: PayloadAction<number>) => {
      state.serverPort = action.payload;
    },
    setSessionState: (state, action: PayloadAction<string>) => {
      state.sessionState = action.payload;
    },
    setManualCall: (state, action: PayloadAction<false | string>) => {
      state.manualCall = action.payload;
    },
    setSelectedCallerId: (state, action: PayloadAction<string | null>) => {
      state.selectedCallerId = action.payload;
    },
    setInvite: (state, action: PayloadAction<boolean>) => {
      state.invite = action.payload;
    },
    setAnswer: (state, action: PayloadAction<boolean>) => {
      state.answer = action.payload;
    },
    setHangup: (state, action: PayloadAction<boolean>) => {
      state.hangup = action.payload;
    },
    setToggleMute: (state, action: PayloadAction<boolean>) => {
      state.toggleMute = action.payload;
    },
    setUnhangup: (state) => {
      state.hangup = false;
    },
    setSipAccounts: (state, action: PayloadAction<SipAccount[]>) => {
      state.sipAccounts = action.payload;
    },
    setSelectedAccount: (state, action: PayloadAction<SipAccount | null>) => {
      state.selectedAccount = action.payload;
      if (action.payload) {
        state.serverUrl = action.payload.sip_server;
        state.serverPort = action.payload.sip_port;
      }
    },
    setUserPhones: (state, action: PayloadAction<UserPhone[]>) => {
      state.userPhones = action.payload;
    },
    setServers: (state, action: PayloadAction<Server[]>) => {
      state.servers = action.payload;
    },
    setPhones: (state, action: PayloadAction<Phone[]>) => {
      state.phones = action.payload;
    },
    setUserSipConfigs: (state, action: PayloadAction<UserSipConfig[]>) => {
      state.userSipConfigs = action.payload;
    },
    setSelectedServer: (state, action: PayloadAction<Server | null>) => {
      state.selectedServer = action.payload;
    },
    setCurrentCredentials: (state, action: PayloadAction<{ username: string; password: string } | null>) => {
      state.currentCredentials = action.payload;
    },
    // Invite link actions
    setCallMode: (state, action: PayloadAction<'manual' | 'invite'>) => {
      state.callMode = action.payload;
    },
    setInviteToken: (state, action: PayloadAction<string | null>) => {
      state.inviteToken = action.payload;
    },
    setActiveInvite: (state, action: PayloadAction<InviteLink | null>) => {
      state.activeInvite = action.payload;
    },
    setInviteLink: (state, action: PayloadAction<string | null>) => {
      state.inviteLink = action.payload;
    },
    setInviteStatus: (state, action: PayloadAction<'idle' | 'creating' | 'active' | 'waiting' | 'connecting' | 'ready'>) => {
      state.inviteStatus = action.payload;
    },
    setCallPartner: (state, action: PayloadAction<{ sip_username: string; telegram_id: string } | null>) => {
      state.callPartner = action.payload;
    },
    setCallStatus: (state, action: PayloadAction<'idle' | 'waiting' | 'connecting' | 'active'>) => {
      state.callStatus = action.payload;
    },
    setBridgeStatus: (state, action: PayloadAction<SipState['bridgeStatus']>) => {
      state.bridgeStatus = action.payload;
    },
    setBridgeSession: (state, action: PayloadAction<BridgeSession | null>) => {
      state.bridgeSession = action.payload;
    },
    setBridgeParticipants: (state, action: PayloadAction<BridgeParticipant[]>) => {
      state.bridgeParticipants = action.payload;
    },
    resetBridge: (state) => {
      state.bridgeSession = null;
      state.bridgeStatus = 'idle';
      state.bridgeParticipants = [];
    },
    resetInvite: (state) => {
      state.callMode = 'manual';
      state.inviteToken = null;
      state.activeInvite = null;
      state.inviteLink = null;
      state.inviteStatus = 'idle';
      state.callPartner = null;
      state.callStatus = 'idle';
    }
  },
});

export const { 
  setStatus, 
  setServerUrl, 
  setManualCall,
  setSelectedCallerId,
  setSessionState, 
  setInvite, 
  setAnswer, 
  setHangup,
  setToggleMute,
  setSipAccounts,
  setSelectedAccount,
  setUserPhones,
  setServers,
  setPhones,
  setUserSipConfigs,
  setSelectedServer,
  setCurrentCredentials,
  setCallMode,
  setInviteToken,
  setActiveInvite,
  setInviteLink,
  setInviteStatus,
  setCallPartner,
  setCallStatus,
  setBridgeStatus,
  setBridgeSession,
  setBridgeParticipants,
  resetBridge,
  resetInvite
} = sipSlice.actions;

export default sipSlice.reducer;
