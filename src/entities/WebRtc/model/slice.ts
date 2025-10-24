import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SipAccount, UserPhone, Server, Phone, UserSipConfig } from '@/lib/api';

interface SipState {
  status: 'online' | 'offline';
  serverUrl: string | null;
  serverPort: number | null;
  sessionState: string;
  manualCall: false | string;
  invite: boolean;
  answer: boolean;
  hangup: boolean;
  sipAccounts: SipAccount[];
  selectedAccount: SipAccount | null;
  userPhones: UserPhone[];
  servers: Server[];
  phones: Phone[];
  userSipConfigs: UserSipConfig[];
  selectedServer: Server | null;
  currentCredentials: { username: string; password: string } | null;
}

const initialState: SipState = {
  status: 'offline',
  serverUrl: null,
  serverPort: null,
  sessionState: '',
  manualCall: false,
  invite: false,
  answer: false,
  hangup: false,
  sipAccounts: [],
  selectedAccount: null,
  userPhones: [],
  servers: [],
  phones: [],
  userSipConfigs: [],
  selectedServer: null,
  currentCredentials: null
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
    setInvite: (state, action: PayloadAction<boolean>) => {
      state.invite = action.payload;
    },
    setAnswer: (state, action: PayloadAction<boolean>) => {
      state.answer = action.payload;
    },
    setHangup: (state, action: PayloadAction<boolean>) => {
      state.hangup = action.payload;
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
    }
  },
});

export const { 
  setStatus, 
  setServerUrl, 
  setManualCall, 
  setSessionState, 
  setInvite, 
  setAnswer, 
  setHangup,
  setSipAccounts,
  setSelectedAccount,
  setUserPhones,
  setServers,
  setPhones,
  setUserSipConfigs,
  setSelectedServer,
  setCurrentCredentials
} = sipSlice.actions;

export default sipSlice.reducer;
