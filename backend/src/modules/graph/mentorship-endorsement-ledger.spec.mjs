import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MentorshipEndorsementLedgerService {
  constructor() { this.l = []; }
  add(e) {
    if (e.from === e.to) return false;
    this.l.push(e);
    return true;
  }
  reputation(to, skill) {
    return this.l
      .filter(e => e.to === to && (!skill || e.skill === skill))
      .reduce((a, c) => a + c.weight, 0);
  }
}

describe('MentorshipEndorsementLedgerService (#2358)', () => {
  test('records valid peer endorsements and disallows self-endorsements', () => {
    const ledger = new MentorshipEndorsementLedgerService();
    assert.strictEqual(ledger.add({ from: 'dev1', to: 'dev1', skill: 'NestJS', weight: 5 }), false);
    assert.strictEqual(ledger.add({ from: 'dev1', to: 'dev2', skill: 'NestJS', weight: 4 }), true);
    assert.strictEqual(ledger.add({ from: 'dev3', to: 'dev2', skill: 'NestJS', weight: 5 }), true);
    assert.strictEqual(ledger.reputation('dev2', 'NestJS'), 9);
  });
});
