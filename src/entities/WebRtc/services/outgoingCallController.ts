import store from '@/app/store';
import { setOutgoingCall } from '../model/slice';
import {
  CallEndReason,
  OutgoingCallInfo,
  OutgoingCallPhase,
  isPhaseAfter,
  parseReasonHeader,
  reasonFromDialstatus,
  reasonFromQ850,
  reasonFromSipCode,
  toneForReason,
} from '../model/outgoingCall';
import { playTone, stopTone, unlockTones, currentTone } from './callTones';
import { getActiveSSE, subscribe, unsubscribe } from '@/shared/hooks/useSSE';

/**
 * Single owner of the outgoing PSTN call status: merges client SIP signalling
 * and server (ARI) events, drives ringback / busy tones and the store.
 */

const SSE_EVENT = 'outgoing_call_state';
/** How long busy/congestion beeps play after the call ends, then the dialer goes idle. */
const END_TONE_MS = 3000;

interface ServerCallEvent {
  call_token?: string;
  state?: 'dialing' | 'ringing' | 'progress' | 'answered' | 'failed' | 'ended';
  dialstatus?: string | null;
  cause?: number | null;
  cause_txt?: string | null;
  hangup_by?: 'local' | 'remote' | null;
}

const SERVER_PHASE: Partial<Record<NonNullable<ServerCallEvent['state']>, OutgoingCallPhase>> = {
  ringing: 'ringing',
  progress: 'early_media',
  answered: 'answered',
};

const newToken = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

class OutgoingCallController {
  private earlyMedia = false;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private toneDeadline = 0;
  private sse: EventSource | null = null;

  private get call(): OutgoingCallInfo | null {
    return store.getState().sip.outgoingCall;
  }

  private update(token: string, patch: Partial<OutgoingCallInfo>): OutgoingCallInfo | null {
    const call = this.call;
    if (!call || call.token !== token) return null;
    const next = { ...call, ...patch };
    store.dispatch(setOutgoingCall(next));
    return next;
  }

  /** Starts tracking a new outgoing call; returns the token for the X-Call-Token header. */
  start(number: string): string {
    this.dismiss();
    unlockTones(); // we're inside the "call" tap — let the AudioContext start now
    const token = newToken();
    this.earlyMedia = false;
    store.dispatch(setOutgoingCall({ token, number, phase: 'dialing' }));

    this.sse = getActiveSSE();
    if (this.sse) {
      this.sse.addEventListener(SSE_EVENT, this.onServerMessage);
      subscribe(SSE_EVENT, token).catch(() => undefined);
    }
    return token;
  }

  // ---- client SIP signalling -------------------------------------------------

  onProgress(token: string, statusCode: number, hasSdp: boolean) {
    const call = this.call;
    if (!call || call.token !== token || call.phase === 'ended' || call.phase === 'answered') return;

    if (statusCode === 183 && hasSdp) {
      // Provider's own audio (ringback / announcement) is coming — stop ours.
      this.earlyMedia = true;
      if (currentTone() === 'ringback') stopTone();
      this.advance(token, 'early_media');
      return;
    }
    if (statusCode === 180 || statusCode === 183) {
      if (!this.earlyMedia && currentTone() !== 'ringback') playTone('ringback');
      this.advance(token, 'ringing');
    }
  }

  onAccept(token: string) {
    if (currentTone()) stopTone();
    if (this.call?.token === token && this.call.phase !== 'ended') {
      this.update(token, { phase: 'answered', answeredAt: Date.now() });
    }
  }

  onReject(token: string, statusCode: number, reasonPhrase: string, reasonHeader?: string) {
    const q850 = parseReasonHeader(reasonHeader);
    this.update(token, {
      sipCode: statusCode,
      sipReason: reasonPhrase,
      ...(q850 && !this.call?.cause ? { cause: q850.cause, causeText: q850.text } : {}),
    });
    this.end(token);
  }

  onRemoteBye(token: string, reasonHeader?: string) {
    const q850 = parseReasonHeader(reasonHeader);
    this.update(token, {
      hangupBy: this.call?.hangupBy ?? 'remote',
      ...(q850 && !this.call?.cause ? { cause: q850.cause, causeText: q850.text } : {}),
    });
    this.end(token);
  }

  /** User pressed "hang up". */
  onLocalHangup() {
    const call = this.call;
    if (!call) return;
    if (call.phase === 'ended') {
      this.dismiss(); // stop the beeps right away
      return;
    }
    this.update(call.token, { hangupBy: 'local' });
  }

  /** sip.js session reached Terminated (always fires, after reject/bye or on its own). */
  onTerminated(token: string) {
    if (currentTone() === 'ringback') stopTone();
    // sip.js moves to Terminated *before* calling requestDelegate.onReject, so
    // let the SIP code land first — otherwise we'd flash "Ошибка вызова".
    setTimeout(() => this.end(token), 0);
  }

  // ---- server (ARI) events ---------------------------------------------------

  private onServerMessage = (message: Event) => {
    let data: ServerCallEvent;
    try {
      const parsed = JSON.parse((message as MessageEvent).data);
      data = (parsed?.payload ?? parsed) as ServerCallEvent;
    } catch {
      return;
    }
    const call = this.call;
    if (!data?.call_token || !call || call.token !== data.call_token) return;
    const token = call.token;

    if (data.dialstatus) this.update(token, { dialstatus: data.dialstatus });

    const phase = data.state ? SERVER_PHASE[data.state] : undefined;
    if (phase) this.advance(token, phase);

    if (data.state === 'ended') {
      this.update(token, {
        ...(data.cause ? { cause: data.cause, causeText: data.cause_txt ?? undefined } : {}),
        // what the user did locally is authoritative over the server's guess
        hangupBy: this.call?.hangupBy ?? data.hangup_by ?? undefined,
      });
      // Usually SIP already ended it and this only refines the reason; if our
      // signalling got lost, this ends the call on the screen.
      this.end(token);
    }
  };

  // ---- internals -------------------------------------------------------------

  private advance(token: string, phase: OutgoingCallPhase) {
    const call = this.call;
    if (call?.token === token && isPhaseAfter(phase, call.phase)) this.update(token, { phase });
  }

  private computeReason(call: OutgoingCallInfo): CallEndReason {
    if (call.hangupBy === 'local') return call.answeredAt ? 'local_hangup' : 'cancelled';
    return (
      (call.cause ? reasonFromQ850(call.cause, call.hangupBy) : null) ??
      (call.dialstatus ? reasonFromDialstatus(call.dialstatus) : null) ??
      (call.sipCode ? reasonFromSipCode(call.sipCode) : null) ??
      (call.hangupBy === 'remote' || call.answeredAt ? 'remote_hangup' : 'failed')
    );
  }

  /** Moves to `ended` (or refines the reason if already there) and plays the end tone. */
  private end(token: string) {
    const call = this.call;
    if (!call || call.token !== token) return;
    const firstTime = call.phase !== 'ended';
    const reason = this.computeReason(call);
    if (!firstTime && reason === call.reason) return;

    this.update(token, { phase: 'ended', reason, endedAt: call.endedAt ?? Date.now() });

    const tone = toneForReason(reason);
    if (firstTime) {
      this.toneDeadline = Date.now() + END_TONE_MS;
      if (tone) playTone(tone, END_TONE_MS);
      else stopTone();
      this.scheduleDismiss(token, END_TONE_MS);
      return;
    }

    // A late, more precise reason (e.g. server Q.850 after SIP 480) — switch
    // the beeps for the time that's left if the tone kind changed.
    const left = this.toneDeadline - Date.now();
    if (left > 300 && tone !== currentTone()) {
      if (tone) playTone(tone, left);
      else stopTone();
    }
  }

  private scheduleDismiss(token: string, ms: number) {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => {
      if (this.call?.token === token) this.dismiss();
    }, ms + 200);
  }

  /** Clears the status line, stops tones, drops the SSE subscription. */
  dismiss() {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    stopTone();
    const call = this.call;
    if (this.sse) {
      this.sse.removeEventListener(SSE_EVENT, this.onServerMessage);
      if (call) unsubscribe(SSE_EVENT, call.token).catch(() => undefined);
      this.sse = null;
    }
    if (call) store.dispatch(setOutgoingCall(null));
  }
}

export const outgoingCallController = new OutgoingCallController();
