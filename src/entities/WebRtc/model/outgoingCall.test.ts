import {
  parseReasonHeader,
  reasonFromDialstatus,
  reasonFromQ850,
  reasonFromSipCode,
  toneForReason,
} from './outgoingCall';

describe('outgoing call status mapping', () => {
  it('maps SIP final responses', () => {
    expect(reasonFromSipCode(486)).toBe('busy');
    expect(reasonFromSipCode(480)).toBe('no_answer');
    expect(reasonFromSipCode(404)).toBe('not_found');
    expect(reasonFromSipCode(503)).toBe('congestion');
    expect(reasonFromSipCode(487)).toBe('cancelled');
    expect(reasonFromSipCode(499)).toBe('failed');
  });

  it('maps Q.850 causes, normal clearing depends on who hung up', () => {
    expect(reasonFromQ850(17)).toBe('busy');
    expect(reasonFromQ850(19)).toBe('no_answer');
    expect(reasonFromQ850(34)).toBe('congestion');
    expect(reasonFromQ850(16, 'remote')).toBe('remote_hangup');
    expect(reasonFromQ850(16, 'local')).toBe('local_hangup');
    expect(reasonFromQ850(16)).toBeNull();
  });

  it('maps DIALSTATUS', () => {
    expect(reasonFromDialstatus('BUSY')).toBe('busy');
    expect(reasonFromDialstatus('CHANUNAVAIL')).toBe('unavailable');
    expect(reasonFromDialstatus('ANSWER')).toBeNull();
  });

  it('parses Reason header', () => {
    expect(parseReasonHeader('Q.850;cause=17;text="User busy"')).toEqual({ cause: 17, text: 'User busy' });
    expect(parseReasonHeader('SIP;cause=200')).toBeNull();
    expect(parseReasonHeader(undefined)).toBeNull();
  });

  it('picks tones: busy beeps, fast beeps for network errors, silence for own hangup', () => {
    expect(toneForReason('busy')).toBe('busy');
    expect(toneForReason('remote_hangup')).toBe('busy');
    expect(toneForReason('congestion')).toBe('congestion');
    expect(toneForReason('local_hangup')).toBeNull();
    expect(toneForReason('cancelled')).toBeNull();
  });
});
