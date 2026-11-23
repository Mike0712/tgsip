/**
 * Outgoing PSTN call status shown in the dialer.
 *
 * Two sources feed it (see services/outgoingCallController.ts):
 *  - the client's own SIP signalling (18x / final response codes / BYE), which
 *    is instant;
 *  - asterserver's ARI tracker via SSE (`outgoing_call_state`), which knows the
 *    real Q.850 hangup cause and DIALSTATUS of the trunk leg.
 */

export type OutgoingCallPhase = 'dialing' | 'ringing' | 'early_media' | 'answered' | 'ended';

export type CallEndReason =
  | 'busy'
  | 'no_answer'
  | 'unavailable'
  | 'not_found'
  | 'rejected'
  | 'congestion'
  | 'remote_hangup'
  | 'local_hangup'
  | 'cancelled'
  | 'failed';

export interface OutgoingCallInfo {
  token: string;
  number: string;
  phase: OutgoingCallPhase;
  reason?: CallEndReason;
  /** Final SIP response code to our INVITE (e.g. 486), if the call failed before answer. */
  sipCode?: number;
  sipReason?: string;
  /** Q.850 cause, from the server (or a Reason header). */
  cause?: number;
  causeText?: string;
  dialstatus?: string;
  hangupBy?: 'local' | 'remote';
  answeredAt?: number;
  endedAt?: number;
}

const PHASE_ORDER: Record<OutgoingCallPhase, number> = {
  dialing: 0,
  ringing: 1,
  early_media: 2,
  answered: 3,
  ended: 4,
};

export const isPhaseAfter = (next: OutgoingCallPhase, current: OutgoingCallPhase) =>
  PHASE_ORDER[next] > PHASE_ORDER[current];

export const reasonFromSipCode = (code: number): CallEndReason => {
  switch (code) {
    case 486:
    case 600:
      return 'busy';
    case 408:
    case 480:
      return 'no_answer';
    case 404:
    case 484:
    case 604:
      return 'not_found';
    case 403:
    case 603:
      return 'rejected';
    case 487:
      return 'cancelled';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'congestion';
    default:
      return 'failed';
  }
};

export const reasonFromQ850 = (cause: number, hangupBy?: 'local' | 'remote'): CallEndReason | null => {
  switch (cause) {
    case 16: // normal clearing
      if (hangupBy === 'local') return 'local_hangup';
      if (hangupBy === 'remote') return 'remote_hangup';
      return null;
    case 17:
      return 'busy';
    case 18: // no user responding
    case 19: // no answer
      return 'no_answer';
    case 20: // subscriber absent
    case 27: // destination out of order
      return 'unavailable';
    case 1: // unallocated number
    case 3: // no route to destination
    case 28: // invalid number format
      return 'not_found';
    case 21:
      return 'rejected';
    case 34:
    case 38:
    case 41:
    case 42:
    case 44:
    case 47:
    case 58:
      return 'congestion';
    default:
      return null;
  }
};

export const reasonFromDialstatus = (dialstatus: string): CallEndReason | null => {
  switch (dialstatus) {
    case 'BUSY':
      return 'busy';
    case 'NOANSWER':
      return 'no_answer';
    case 'CONGESTION':
      return 'congestion';
    case 'CHANUNAVAIL':
      return 'unavailable';
    case 'CANCEL':
      return 'cancelled';
    default:
      return null;
  }
};

/** "Q.850;cause=17;text=\"User busy\"" -> { cause: 17, text: 'User busy' } */
export const parseReasonHeader = (header: string | undefined): { cause: number; text?: string } | null => {
  if (!header || !/^\s*Q\.850/i.test(header)) return null;
  const cause = header.match(/cause=(\d+)/i);
  if (!cause) return null;
  const text = header.match(/text="([^"]*)"/i);
  return { cause: Number(cause[1]), text: text?.[1] };
};

export type CallTone = 'busy' | 'congestion';

/** Which tone to play once the call has ended; null = silence (we hung up ourselves). */
export const toneForReason = (reason: CallEndReason | undefined): CallTone | null => {
  switch (reason) {
    case 'busy':
    case 'no_answer':
    case 'rejected':
    case 'remote_hangup':
      return 'busy';
    case 'unavailable':
    case 'not_found':
    case 'congestion':
    case 'failed':
      return 'congestion';
    default:
      return null;
  }
};

const REASON_LABELS: Record<CallEndReason, string> = {
  busy: 'Занято',
  no_answer: 'Абонент не отвечает',
  unavailable: 'Абонент недоступен',
  not_found: 'Номер не существует',
  rejected: 'Вызов отклонён',
  congestion: 'Сеть перегружена',
  remote_hangup: 'Собеседник завершил вызов',
  local_hangup: 'Вызов завершён',
  cancelled: 'Вызов отменён',
  failed: 'Ошибка вызова',
};

export const outgoingCallLabel = (call: OutgoingCallInfo): string => {
  switch (call.phase) {
    case 'dialing':
      return 'Набор номера…';
    case 'ringing':
    case 'early_media':
      return 'Вызов…';
    case 'answered':
      return 'Идёт разговор';
    case 'ended':
      return call.reason ? REASON_LABELS[call.reason] : 'Вызов завершён';
  }
};

/** Technical detail line, e.g. "SIP 486 · Q.850 17 (USER_BUSY)". */
export const outgoingCallDetails = (call: OutgoingCallInfo): string | null => {
  if (call.phase !== 'ended') return null;
  const parts: string[] = [];
  if (call.sipCode) parts.push(`SIP ${call.sipCode}`);
  if (call.cause) parts.push(`Q.850 ${call.cause}${call.causeText ? ` (${call.causeText})` : ''}`);
  return parts.length ? parts.join(' · ') : null;
};
