import { UserAgent, UserAgentOptions, Registerer, RegistererState, Inviter, Invitation, URI, Session, SessionState } from 'sip.js';
import store, { RootState } from '@/app/store';
import { setStatus, setInvite, setAnswer, setHangup } from '../model/slice';

class SipService {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private session: Inviter | Invitation | object = {};

  constructor(private host: string | null, private port: number | null, private username: string, private password: string, private turnServer: string | null) { }

  initialize() {
    const userAgentOptions: UserAgentOptions = {
      uri: UserAgent.makeURI(`sip:${this.username}@${this.host}`),
      transportOptions: {
        server: `wss://${this.host}:${this.port}/ws`,
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
    if (this.turnServer) {
      const [turnIp, turnUsername, turnPassword] = this.turnServer.split(':');

      userAgentOptions.sessionDescriptionHandlerFactoryOptions = {
        peerConnectionConfiguration: {
          iceServers: [
            {
              urls: [
                `turn:${turnIp}:3478?transport=udp`,
                `turn:${turnIp}:3478?transport=tcp`
              ],
              username: turnUsername,
              credential: turnPassword
            }
          ],
          iceTransportPolicy: "relay"
        }
      };
    };

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
          switch (state) {
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

  async makeCall(phone: string, listener: (state: string) => void, callerId?: string | null, args?: string[]) {
    const extraHeaders = args || [];
    if (process.env.NODE_ENV === 'development') {
      extraHeaders.push('X-app: test');
    }
    // Добавляем Caller ID в SIP headers если передан
    if (callerId) {
      extraHeaders.push(`P-Asserted-Identity: <sip:${callerId}@${this.host}>`);
      extraHeaders.push(`Remote-Party-ID: <sip:${callerId}@${this.host}>;party=calling;privacy=off`);
      console.log('📞 Using Caller ID:', callerId);
    }

    const target = UserAgent.makeURI(`sip:${phone}@${this.host}`);
    try {
      // Запрашиваем микрофон ДО звонка (критично для мобильных)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log('🎤 Microphone access granted');
        // Останавливаем стрим, SIP.js создаст свой
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.error('❌ Microphone access denied:', micError);
        alert('Для звонка необходим доступ к микрофону');
        return;
      }

      if (this.userAgent instanceof UserAgent && target instanceof URI) {
        const pc: RTCPeerConnection = (this.session as { peerConnection: RTCPeerConnection }).peerConnection;
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
          if (this.turnServer) {
             const pc = (this.session.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection }).peerConnection;
             let relayFound = false;
              // 1) Слушаем появление кандидатов
              pc.onicecandidate = (e) => {
                if (e.candidate && e.candidate.candidate.includes("typ relay")) {
                  relayFound = true;
                  console.log("TURN relay candidate detected");
                }
              };

              // 2) Слушаем завершение ICE-gathering
              pc.onicegatheringstatechange = () => {
                if (pc.iceGatheringState === "complete") {
                  console.log("ICE gathering completed");

                  if (!relayFound) {
                    console.error("TURN relay not found — aborting call");
                    (this.session as Session).bye();
                  }
                }
              };

              // 3) Дополнительно можно слушать ICE connection events
              pc.oniceconnectionstatechange = () => {
                console.log("ICE state:", pc.iceConnectionState);

                if (pc.iceConnectionState === "failed") {
                  console.error("ICE failed — likely TURN issue");
                  (this.session as Session).bye();
                }
              };
          }
        }
      }
    } catch ($e) {
      console.log($e, 'err');
    }
  }

  async makeCallToSipAccount(sipUsername: string, listener: (state: string) => void) {
    const target = UserAgent.makeURI(`sip:${ sipUsername } @${ this.host } `);
    
    try {
      // Запрашиваем микрофон ДО звонка (критично для мобильных)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log('🎤 Microphone access granted');
        // Останавливаем стрим, SIP.js создаст свой
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.error('❌ Microphone access denied:', micError);
        alert('Для звонка необходим доступ к микрофону');
        return;
      }

      if (this.userAgent instanceof UserAgent && target instanceof URI) {
        this.session = new Inviter(this.userAgent, target, {
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false }
          }
        });
        if (this.session instanceof Session) {
          this.session.stateChange.addListener((state: string) => {
            this.listenSessionState(state);
            listener(state);
          });
          console.log(`📞 Calling SIP account: ${ sipUsername } `);
          this.session.invite();
        }
      }
    } catch ($e) {
      console.error('❌ Error making call to SIP account:', $e);
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

  toggleMute() {
    if (!(this.session instanceof Session)) {
      console.warn('⚠️ No active session for toggleMute');
      return false;
    }

    const peerConnection = (this.session.sessionDescriptionHandler as any)?.peerConnection;
    if (!peerConnection) {
      console.warn('⚠️ No peer connection for toggleMute');
      return false;
    }

    // Получаем все local audio tracks через senders
    const senders = peerConnection.getSenders();
    let currentMutedState: boolean | null = null;
    let hasAudioTracks = false;

    for (const sender of senders) {
      if (sender.track && sender.track.kind === 'audio') {
        hasAudioTracks = true;
        // Определяем текущее состояние по первому треку (muted = !enabled)
        if (currentMutedState === null) {
          currentMutedState = !sender.track.enabled;
        }
        // Переключаем: устанавливаем enabled в противоположное значение
        sender.track.enabled = !currentMutedState;
        console.log(`🔇 Local audio track ${sender.track.enabled ? 'unmuted' : 'muted'}`);
      }
    }

    if (!hasAudioTracks) {
      console.warn('⚠️ No local audio tracks found for toggleMute');
      return false;
    }

    // Возвращаем новое состояние (muted = !enabled)
    return !currentMutedState;
  }

  private setupRemoteMedia() {
    const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
    const remoteStream = new MediaStream();
    if (mediaElement) {
      mediaElement.addEventListener('error', console.error);
      mediaElement.addEventListener('suspend', console.log);
      mediaElement.addEventListener('abort', console.log);
      mediaElement.addEventListener('volumechange', console.log);
      mediaElement.addEventListener('ended', console.log);
      if (this.session instanceof Session) {
        const peerConnection = (this.session.sessionDescriptionHandler as any)?.peerConnection;
        if (peerConnection) {
          for (const receiver of peerConnection.getReceivers()) {
            if (receiver.track) {
              remoteStream.addTrack(receiver.track);
              console.log('🎵 Added remote track:', receiver.track.kind);
            }
          }
        }
      }
      mediaElement.srcObject = remoteStream;
      mediaElement.volume = 1.0;
      
      // Критично для iOS/Safari
      mediaElement.setAttribute('playsinline', 'true');
      mediaElement.setAttribute('autoplay', 'true');
      
      console.log('🔊 Starting remote media playback...');
      return mediaElement.play()
        .then(() => console.log('✅ Remote audio playing'))
        .catch(err => {
          console.error('❌ Audio playback failed:', err);
          // Уведомляем UI что нужен user interaction
          window.dispatchEvent(new Event('audio-play-failed'));
          // Попытка воспроизведения после user interaction
          document.addEventListener('click', () => {
            mediaElement.play().catch(console.error);
          }, { once: true });
        });
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
