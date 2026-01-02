// Mock for sip.js to avoid ES module issues in tests
module.exports = {
  UserAgent: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    register: jest.fn(),
    unregister: jest.fn(),
    stateChange: {
      on: jest.fn(),
      off: jest.fn(),
    },
  })),
  Registerer: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    unregister: jest.fn(),
    stateChange: {
      on: jest.fn(),
      off: jest.fn(),
    },
    state: 'Registered',
  })),
  Inviter: jest.fn(),
  Invitation: jest.fn(),
  URI: jest.fn(),
  Session: jest.fn(),
  SessionState: {
    Initial: 'Initial',
    Establishing: 'Establishing',
    Established: 'Established',
    Terminated: 'Terminated',
  },
  RegistererState: {
    Registered: 'Registered',
    Unregistered: 'Unregistered',
    Terminated: 'Terminated',
  },
};

