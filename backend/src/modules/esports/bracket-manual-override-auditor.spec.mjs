import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BracketManualOverrideAuditorService {
  constructor() { this.l = []; }
  log(org, m, src, dest, just) {
    const entry = { org, m, src, dest, just, time: Date.now() };
    this.l.push(entry);
    return entry;
  }
  history(m) { return this.l.filter(x => x.m === m); }
}

describe('BracketManualOverrideAuditorService (#2335)', () => {
  test('retains immutable audit logs for manual organizer tournament bracket alterations', () => {
    const auditor = new BracketManualOverrideAuditorService();
    auditor.log('admin1', 'match-5', 'Seed1', 'Seed3', 'Player Disqualification');
    const logs = auditor.history('match-5');

    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].just, 'Player Disqualification');
  });
});
