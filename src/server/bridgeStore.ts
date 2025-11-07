import { randomUUID } from 'crypto';

export type BridgeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'terminated';
export type BridgeParticipantStatus = 'pending' | 'dialing' | 'joined' | 'failed' | 'left';

export interface BridgeParticipantRecord {
  id: string;
  bridge_id: string;
  type: 'user' | 'sip' | 'phone' | 'external';
  role: 'initiator' | 'participant';
  reference: string;
  display_name?: string;
  status: BridgeParticipantStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BridgeRecord {
  id: string;
  creator_id: number;
  status: BridgeStatus;
  target?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  participants: BridgeParticipantRecord[];
}

const bridges = new Map<string, BridgeRecord>();

const cloneParticipant = (participant: BridgeParticipantRecord): BridgeParticipantRecord => ({
  ...participant,
  metadata: participant.metadata ? { ...participant.metadata } : undefined,
});

const cloneBridge = (bridge: BridgeRecord): BridgeRecord => ({
  ...bridge,
  metadata: bridge.metadata ? { ...bridge.metadata } : undefined,
  participants: bridge.participants.map(cloneParticipant),
});

export const bridgeStore = {
  createBridge(options: {
    creatorId: number;
    target?: string;
    metadata?: Record<string, unknown>;
    initiatorDisplayName?: string;
  }): BridgeRecord {
    const now = new Date().toISOString();
    const bridgeId = randomUUID();

    const initiatorParticipant: BridgeParticipantRecord = {
      id: randomUUID(),
      bridge_id: bridgeId,
      type: 'user',
      role: 'initiator',
      reference: String(options.creatorId),
      display_name: options.initiatorDisplayName,
      status: 'joined',
      created_at: now,
      updated_at: now,
    };

    const bridge: BridgeRecord = {
      id: bridgeId,
      creator_id: options.creatorId,
      status: 'pending',
      target: options.target,
      metadata: options.metadata ? { ...options.metadata } : undefined,
      created_at: now,
      updated_at: now,
      participants: [initiatorParticipant],
    };

    bridges.set(bridgeId, bridge);
    return cloneBridge(bridge);
  },

  getBridge(bridgeId: string): BridgeRecord | null {
    const bridge = bridges.get(bridgeId);
    return bridge ? cloneBridge(bridge) : null;
  },

  listByCreator(creatorId: number): BridgeRecord[] {
    return Array.from(bridges.values())
      .filter((bridge) => bridge.creator_id === creatorId)
      .map(cloneBridge);
  },

  addParticipant(bridgeId: string, participant: Omit<BridgeParticipantRecord, 'id' | 'bridge_id' | 'created_at' | 'updated_at' | 'status'> & {
    status?: BridgeParticipantStatus;
  }): BridgeParticipantRecord[] {
    const bridge = bridges.get(bridgeId);

    if (!bridge) {
      throw new Error('Bridge not found');
    }

    const now = new Date().toISOString();
    const participantRecord: BridgeParticipantRecord = {
      id: randomUUID(),
      bridge_id: bridgeId,
      status: participant.status ?? 'pending',
      created_at: now,
      updated_at: now,
      ...participant,
      metadata: participant.metadata ? { ...participant.metadata } : undefined,
    };

    bridge.participants.push(participantRecord);
    bridge.updated_at = now;

    bridges.set(bridgeId, bridge);

    return bridge.participants.map(cloneParticipant);
  },

  updateStatus(bridgeId: string, status: BridgeStatus): BridgeRecord {
    const bridge = bridges.get(bridgeId);

    if (!bridge) {
      throw new Error('Bridge not found');
    }

    bridge.status = status;
    bridge.updated_at = new Date().toISOString();
    bridges.set(bridgeId, bridge);

    return cloneBridge(bridge);
  },

  terminateBridge(bridgeId: string): BridgeRecord {
    return this.updateStatus(bridgeId, 'terminated');
  },
};

