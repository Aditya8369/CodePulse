import { Injectable } from '@nestjs/common';

export interface TurnAllocation {
  allocationId: string;
  relayAddress: string;
  port: number;
  protocol: 'udp' | 'tcp' | 'tls';
  allocatedAt: number;
  expiresAt: number;
}

export interface CandidateBinding {
  candidateId: string;
  peerId: string;
  candidateType: 'host' | 'srflx' | 'prflx' | 'relay';
  address: string;
  port: number;
  isSymmetricNat: boolean;
}

@Injectable()
export class WebrtcIceTurnPoolService {
  private readonly turnRelayPool: TurnAllocation[] = [];
  private readonly peerCandidateBindings = new Map<string, CandidateBinding[]>();
  private readonly maxCandidatesPerPeer = 16;

  constructor() {
    this.seedTurnRelayPool();
  }

  private seedTurnRelayPool(): void {
    for (let i = 0; i < 8; i++) {
      this.turnRelayPool.push({
        allocationId: `turn-relay-${i + 1}`,
        relayAddress: `198.51.100.${10 + i}`,
        port: 3478 + i,
        protocol: i % 2 === 0 ? 'udp' : 'tcp',
        allocatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });
    }
  }

  public registerCandidate(peerId: string, candidate: Omit<CandidateBinding, 'isSymmetricNat'>): {
    accepted: boolean;
    requiresTurnRelay: boolean;
    turnAllocation?: TurnAllocation;
    reason?: string;
  } {
    const existing = this.peerCandidateBindings.get(peerId) || [];
    
    // Symmetric NAT detection: Multiple mapping candidates from different ports for same private host
    const isSymmetric = existing.some(
      (c) => c.candidateType === 'srflx' && candidate.candidateType === 'srflx' && c.port !== candidate.port
    );

    if (existing.length >= this.maxCandidatesPerPeer) {
      // Evict oldest non-relay candidate to prevent exhaustion
      const pruneIndex = existing.findIndex((c) => c.candidateType !== 'relay');
      if (pruneIndex !== -1) {
        existing.splice(pruneIndex, 1);
      }
    }

    const bound: CandidateBinding = {
      ...candidate,
      isSymmetricNat: isSymmetric,
    };
    existing.push(bound);
    this.peerCandidateBindings.set(peerId, existing);

    if (isSymmetric || candidate.candidateType === 'relay') {
      const turn = this.allocateTurnRelay();
      return { accepted: true, requiresTurnRelay: true, turnAllocation: turn };
    }

    return { accepted: true, requiresTurnRelay: false };
  }

  public allocateTurnRelay(): TurnAllocation {
    const available = this.turnRelayPool.find((t) => t.expiresAt > Date.now());
    if (available) return available;
    
    const fallback: TurnAllocation = {
      allocationId: `turn-emergency-${Date.now()}`,
      relayAddress: '203.0.113.50',
      port: 5349,
      protocol: 'tls',
      allocatedAt: Date.now(),
      expiresAt: Date.now() + 1800000,
    };
    this.turnRelayPool.push(fallback);
    return fallback;
  }

  public getPeerCandidates(peerId: string): CandidateBinding[] {
    return this.peerCandidateBindings.get(peerId) || [];
  }

  public cleanupPeer(peerId: string): void {
    this.peerCandidateBindings.delete(peerId);
  }
}
