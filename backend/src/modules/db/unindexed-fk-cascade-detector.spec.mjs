import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class UnindexedFkCascadeDetectorService {
  detect(fks) {
    return fks.filter(f => f.cascade && !f.indexed);
  }
}

describe('UnindexedFkCascadeDetectorService (#2159)', () => {
  test('detects hazardous unindexed foreign key cascades prone to table-lock freezes', () => {
    const detector = new UnindexedFkCascadeDetectorService();
    const fks = [
      { name: 'fk_users', cascade: true, indexed: true },
      { name: 'fk_battles_audit', cascade: true, indexed: false },
    ];
    const hazards = detector.detect(fks);
    assert.strictEqual(hazards.length, 1);
    assert.strictEqual(hazards[0].name, 'fk_battles_audit');
  });
});
