import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebrtcIceTurnPoolService {
  constructor() {
    this.turnRelayPool = [
      { allocationId: 'relay-1', relayAddress: '198.51.100.10', port: 3478, protocol: 'udp', expiresAt: Date.now() + 3600000 },
      { allocationId: 'relay-2', relayAddress: '198.51.100.11', port: 3479, protocol: 'tcp', expiresAt: Date.now() + 3600000 },
    ];
    this.peerCandidateBindings = new Map();
    this.maxCandidatesPerPeer = 4;
  }

  registerCandidate(peerId, candidate) {
    const existing = this.peerCandidateBindings.get(peerId) || [];
    const isSymmetric = existing.some(c => c.candidateType === 'srflx' && candidate.candidateType === 'srflx' && c.port !== candidate.port);
    if (existing.length >= this.maxCandidatesPerPeer) {
      existing.shift();
    }
    const bound = { ...candidate, isSymmetricNat: isSymmetric };
    existing.push(bound);
    this.peerCandidateBindings.set(peerId, existing);
    if (isSymmetric || candidate.candidateType === 'relay') {
      return { accepted: true, requiresTurnRelay: true, turnAllocation: this.turnRelayPool[0] };
    }
    return { accepted: true, requiresTurnRelay: false };
  }
}

describe('WebrtcIceTurnPoolService (#2106)', () => {
  test('detects symmetric NAT and triggers TURN allocation without candidate explosion', () => {
    const service = new WebrtcIceTurnPoolService();
    const res1 = service.registerCandidate('peer-1', { candidateId: 'c1', candidateType: 'host', port: 50000 });
    assert.strictEqual(res1.accepted, true);
    assert.strictEqual(res1.requiresTurnRelay, false);

    service.registerCandidate('peer-1', { candidateId: 'c2', candidateType: 'srflx', port: 40001 });
    const res3 = service.registerCandidate('peer-1', { candidateId: 'c3', candidateType: 'srflx', port: 40002 });
    assert.strictEqual(res3.requiresTurnRelay, true);
    assert.strictEqual(res3.turnAllocation.protocol, 'udp');
  });
});
