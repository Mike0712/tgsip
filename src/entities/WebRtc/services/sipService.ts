import { UserAgent, UserAgentOptions, Registerer, RegistererState, Inviter, Invitation, URI, Session, SessionState } from 'sip.js';
import store, { RootState } from '@/app/store';
import { setStatus, setInvite, setAnswer, setHangup } from '../model/slice';

class SipService {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private session: Inviter | Invitation | object = {};

  constructor(private host: string | null, private username: string, private password: string) {}

  initialize() {
    const userAgentOptions: UserAgentOptions = {
      uri: UserAgent.makeURI(`sip:${this.username}@${this.host}`),
      transportOptions: {
        server: `wss://${this.host}:8189/ws`,
      },
      authorizationUsername: this.username,
      authorizationPassword: this.password,
      delegate: {
        onInvite: (invitation) => {
          this.session = invitation;
          store.dispatch(setInvite(true));
        },
        onConnect: () => {
          console.log('✅ WebSocket connected');
        },
        onDisconnect: (error?: Error) => {
          console.error('❌ WebSocket disconnected:', error);
          store.dispatch(setStatus('offline'));
        }
      }
    };

    console.log('🔌 Connecting to:', `wss://${this.host}:8189/ws`);
    console.log('👤 SIP URI:', `sip:${this.username}@${this.host}`);

    this.userAgent = new UserAgent(userAgentOptions);
    this.registerer = new Registerer(this.userAgent);

    this.userAgent.start()
      .then(() => {
        console.log('✅ UserAgent started, registering...');
        this.registerer!.register();
        return this.registerer;
      })
      .then((registerer) => {
        registerer?.stateChange.addListener((state) => {
          console.log('📞 Registerer state:', state);
          switch(state) {
            case RegistererState.Initial:
              break;
            case RegistererState.Registered:
              store.dispatch(setStatus('online'));
              break;
            case RegistererState.Unregistered:
              store.dispatch(setStatus('offline'));
              break;
            case RegistererState.Terminated:
              break;
          }
        })
      })
      .catch((error) => {
        console.error('❌ SIP initialization error:', error);
        store.dispatch(setStatus('offline'));
      });
  }

  makeCall(phone: string, listener: (state: string) => void) {
    const extraHeaders: string[] = [];
    const target = UserAgent.makeURI(`sip:${phone}@${this.host}`);
    try {
      if (this.userAgent instanceof UserAgent && target instanceof URI) {
        this.session = new Inviter(this.userAgent, target, {
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false }
          },
          extraHeaders
        });
        if (this.session instanceof Session) {
          this.session.stateChange.addListener((state: string) => {
            this.listenSessionState(state);
            listener(state);
          });
          this.session.invite();
        }
      }
    } catch($e) {
      console.log($e, 'err');
    }
  }
  answer() {
    if (this.session instanceof Invitation) {
      this.session.stateChange.addListener((state: string) => {
        this.listenSessionState(state);
      });
      this.session.accept();
      store.dispatch(setAnswer(false));
    }
  }
  hangup() {
    if (this.session instanceof Session && this.session.state !== SessionState.Terminated) {
      this.session.bye();
      store.dispatch(setHangup(false));
    }
  }
  getSession() {
    return this.session;
  }

  sendDTMF(tone: string) {
    if (this.session instanceof Session) {
      const dtmfOptions = {
        duration: 100,
        interToneGap: 70
      };
      
      this.session.sessionDescriptionHandler?.sendDtmf(tone, dtmfOptions);
      console.log('📞 DTMF sent:', tone);
    } else {
      console.warn('⚠️ No active session to send DTMF');
    }
  }

  private setupRemoteMedia() {
    const mediaElement = document.getElementById('mediaElement');
    const remoteStream = new MediaStream();
    if (mediaElement) {
      mediaElement.addEventListener('error', console.error);
      mediaElement.addEventListener('suspend', console.log);
      mediaElement.addEventListener('abort', console.log);
      mediaElement.addEventListener('volumechange', console.log);
      mediaElement.addEventListener('ended', console.log);
      if (this.session instanceof Session) {
        for (const receiver of this.session?.sessionDescriptionHandler?.peerConnection?.getReceivers()) {
          if (receiver.track) {
              remoteStream.addTrack(receiver.track);
          }
      }
      }
      mediaElement.srcObject = remoteStream;
      return mediaElement.play();
    }
  }

  private listenSessionState(state: string) {
    switch (state) {
      case SessionState.Established:
        this.setupRemoteMedia();
        break;
      case SessionState.Terminated:
        break;  
    }
  }
}

export default SipService;
