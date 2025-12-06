import { UserAgent, UserAgentOptions, Registerer, RegistererState, Inviter, Invitation, URI, Session, SessionState } from 'sip.js';
import store, { RootState } from '@/app/store';
import { setStatus, setInvite, setAnswer, setHangup } from '../model/slice';

class SipService {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private session: Inviter | Invitation | object = {};
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private currentVolume: number = 1.0;
  private isMuted: boolean = false;

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
      this.cleanupAudioResources();
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
    const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
    if (!mediaElement) {
      console.error('❌ mediaElement not found');
      return;
    }

    mediaElement.addEventListener('error', console.error);
    mediaElement.addEventListener('suspend', console.log);
    mediaElement.addEventListener('abort', console.log);
    mediaElement.addEventListener('volumechange', console.log);
    mediaElement.addEventListener('ended', console.log);

    if (!(this.session instanceof Session)) {
      console.error('❌ No active session');
      return;
    }

    const peerConnection = (this.session.sessionDescriptionHandler as any)?.peerConnection;
    if (!peerConnection) {
      console.error('❌ No peer connection');
      return;
    }

    // Собираем remote audio tracks
    const remoteStream = new MediaStream();
    for (const receiver of peerConnection.getReceivers()) {
      if (receiver.track && receiver.track.kind === 'audio') {
        remoteStream.addTrack(receiver.track);
        console.log('🎵 Added remote audio track');
      }
    }

    if (remoteStream.getAudioTracks().length === 0) {
      console.warn('⚠️ No remote audio tracks found');
      return;
    }

    try {
      // Создаем AudioContext для управления громкостью через Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Создаем узлы Web Audio API
      this.audioSource = this.audioContext.createMediaStreamSource(remoteStream);
      this.gainNode = this.audioContext.createGain();
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      // Подключаем цепочку: source -> gain -> destination
      this.audioSource.connect(this.gainNode);
      this.gainNode.connect(this.audioDestination);
      
      // Устанавливаем начальную громкость и muted состояние
      this.gainNode.gain.value = this.currentVolume;
      this.updateMutedState();
      
      // Подключаем обработанный поток к audio элементу
      mediaElement.srcObject = this.audioDestination.stream;
      mediaElement.volume = 1.0; // Всегда на максимуме, громкость контролируется через gainNode
      
      // Критично для iOS/Safari
      mediaElement.setAttribute('playsinline', 'true');
      mediaElement.setAttribute('autoplay', 'true');
      
      console.log('🔊 Starting remote media playback with Web Audio API...');
      return mediaElement.play()
        .then(() => console.log('✅ Remote audio playing with volume control'))
        .catch(err => {
          console.error('❌ Audio playback failed:', err);
          window.dispatchEvent(new Event('audio-play-failed'));
          document.addEventListener('click', () => {
            mediaElement.play().catch(console.error);
          }, { once: true });
        });
    } catch (error) {
      console.error('❌ Failed to setup Web Audio API, falling back to direct stream:', error);
      // Fallback: используем прямой поток без Web Audio API
      mediaElement.srcObject = remoteStream;
      mediaElement.volume = this.currentVolume;
      mediaElement.muted = this.isMuted;
      
      mediaElement.setAttribute('playsinline', 'true');
      mediaElement.setAttribute('autoplay', 'true');
      
      return mediaElement.play()
        .then(() => console.log('✅ Remote audio playing (fallback mode)'))
        .catch(err => {
          console.error('❌ Audio playback failed:', err);
          window.dispatchEvent(new Event('audio-play-failed'));
        });
    }
  }

  // Установка громкости через Web Audio API
  setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(2, volume)); // Ограничиваем от 0 до 2
    
    if (this.gainNode) {
      // Учитываем muted состояние: если muted, gain остается 0, иначе устанавливаем volume
      this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;
      console.log(`🔊 Volume set via Web Audio API: ${this.currentVolume}, muted: ${this.isMuted}`);
    } else {
      // Fallback: используем audio элемент напрямую
      const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
      if (mediaElement) {
        mediaElement.volume = this.currentVolume;
        console.log(`🔊 Volume set via audio element: ${this.currentVolume}`);
      }
    }
  }

  // Установка muted состояния
  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.updateMutedState();
  }

  private updateMutedState() {
    if (this.gainNode) {
      // Через Web Audio API: устанавливаем gain в 0 для mute, иначе используем текущую громкость
      this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;
      console.log(`🔇 Muted state via Web Audio API: ${this.isMuted}, volume: ${this.currentVolume}`);
    } else {
      // Fallback: используем audio элемент
      const mediaElement = document.getElementById('mediaElement') as HTMLMediaElement | null;
      if (mediaElement) {
        mediaElement.muted = this.isMuted;
        console.log(`🔇 Muted state via audio element: ${this.isMuted}`);
      }
    }
  }

  // Получить текущую громкость
  getVolume(): number {
    return this.currentVolume;
  }

  // Получить muted состояние
  getMuted(): boolean {
    return this.isMuted;
  }

  private cleanupAudioResources() {
    // Отключаем и закрываем Web Audio API ресурсы
    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch (e) {
        console.warn('Error disconnecting audio source:', e);
      }
      this.audioSource = null;
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {
        console.warn('Error disconnecting gain node:', e);
      }
      this.gainNode = null;
    }
    
    if (this.audioDestination) {
      try {
        this.audioDestination.disconnect();
      } catch (e) {
        console.warn('Error disconnecting audio destination:', e);
      }
      this.audioDestination = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.warn('Error closing audio context:', err);
      });
      this.audioContext = null;
    }
    
    console.log('🧹 Audio resources cleaned up');
  }

  private listenSessionState(state: string) {
    switch (state) {
      case SessionState.Established:
        this.setupRemoteMedia();
        break;
      case SessionState.Terminated:
        this.cleanupAudioResources();
        break;
    }
  }
}

export default SipService;
