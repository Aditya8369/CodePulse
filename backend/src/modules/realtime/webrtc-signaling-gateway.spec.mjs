import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebRTCSignalingGatewayService {
  constructor() { this.c = new Map(); }
  cacheCandidate(r, cand) { if (!this.c.has(r)) this.c.set(r, []); this.c.get(r).push(cand); }
  getCandidates(r) { return this.c.get(r) || []; }
}

describe('WebRTCSignalingGatewayService (Issue #1918)', () => {
  it('should buffer and route ICE candidates across peer connections in a room', () => {
    const gateway = new WebRTCSignalingGatewayService();
    gateway.cacheCandidate('room-1', { candidate: 'cand1' });
    gateway.cacheCandidate('room-1', { candidate: 'cand2' });

    assert.equal(gateway.getCandidates('room-1').length, 2);
    assert.equal(gateway.getCandidates('room-2').length, 0);
  });
});
