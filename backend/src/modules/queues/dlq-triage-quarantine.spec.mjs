import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DLQTriageQuarantineService {
  constructor(maxAttempts = 5) {
    this.maxAttempts = maxAttempts;
    this.quarantineStore = new Map();
  }
  triage(message) {
    const err = message.errorReason.toLowerCase();
    const isPoison = err.includes('syntaxerror') || err.includes('unexpected token') || err.includes('malformed');
    if (isPoison) {
      this.quarantineStore.set(message.id, message);
      return { messageId: message.id, category: 'POISON_PILL', quarantined: true };
    }
    if (message.attemptCount >= this.maxAttempts) {
      this.quarantineStore.set(message.id, message);
      return { messageId: message.id, category: 'FATAL_EXPIRED', quarantined: true };
    }
    const delay = Math.min(30000, 1000 * Math.pow(2, message.attemptCount));
    return { messageId: message.id, category: 'TRANSIENT_RETRY', quarantined: false, scheduledNextRetryMs: delay };
  }
  getQuarantinedCount() { return this.quarantineStore.size; }
}

describe('DLQTriageQuarantineService (Issue #1801)', () => {
  it('should quarantine poison pill messages immediately while scheduling transient errors for retry', () => {
    const triageService = new DLQTriageQuarantineService(3);
    const poison = { id: 'm-1', topic: 'events', payload: '{broken', errorReason: 'SyntaxError: Unexpected token', attemptCount: 1 };
    const rPoison = triageService.triage(poison);
    assert.equal(rPoison.category, 'POISON_PILL');
    assert.equal(rPoison.quarantined, true);
    assert.equal(triageService.getQuarantinedCount(), 1);

    const transient = { id: 'm-2', topic: 'events', payload: '{"valid":true}', errorReason: 'ECONNRESET', attemptCount: 1 };
    const rTransient = triageService.triage(transient);
    assert.equal(rTransient.category, 'TRANSIENT_RETRY');
    assert.equal(rTransient.quarantined, false);
    assert.equal(rTransient.scheduledNextRetryMs > 0, true);
  });
});
