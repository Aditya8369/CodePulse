import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SessionHijackDetectorService {
  constructor() { this.s = new Map(); }
  registerSession(base) { this.s.set(base.sessionId, base); }
  evaluateRequest(id, sub, ua) {
    const b = this.s.get(id);
    if (!b) return { hijacked: false };
    if (b.userAgent !== ua) return { hijacked: true, reason: 'UA_MUTATION' };
    if (b.ipSubnet !== sub) return { hijacked: true, reason: 'SUBNET_JUMP' };
    return { hijacked: false };
  }
}

describe('SessionHijackDetectorService (Issue #1860)', () => {
  it('should detect session hijacking when user-agent shifts or subnet jumps abruptly', () => {
    const detector = new SessionHijackDetectorService();
    detector.registerSession({ sessionId: 'sess-1', ipSubnet: '192.168.1.0/24', userAgent: 'Mozilla/5.0' });

    assert.equal(detector.evaluateRequest('sess-1', '192.168.1.0/24', 'Mozilla/5.0').hijacked, false);
    assert.equal(detector.evaluateRequest('sess-1', '10.0.0.0/24', 'Mozilla/5.0').hijacked, true, 'Subnet jump must flag hijack');
    assert.equal(detector.evaluateRequest('sess-1', '192.168.1.0/24', 'curl/7.68.0').hijacked, true, 'UA shift must flag hijack');
  });
});
