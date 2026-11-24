import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DoubleEntryLedgerSentinelService {
  constructor() { this.nonces = new Set(); }
  process(e) {
    if (this.nonces.has(e.nonce) || e.amount <= 0) return false;
    this.nonces.add(e.nonce);
    return true;
  }
}

describe('DoubleEntryLedgerSentinelService (#2168)', () => {
  test('rejects replayed XP ledger transactions with duplicate nonces', () => {
    const sentinel = new DoubleEntryLedgerSentinelService();
    const tx = { nonce: 'nonce-123', amount: 50 };
    assert.strictEqual(sentinel.process(tx), true);
    assert.strictEqual(sentinel.process(tx), false); // Replay fails
  });
});
