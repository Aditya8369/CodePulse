import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildQuestGoalValidatorService {
  eval(q) {
    const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
    return { done: q.progress >= q.target, pct };
  }
}

describe('GuildQuestGoalValidatorService (#2364)', () => {
  test('calculates quest percentage and flags completed milestone goals', () => {
    const validator = new GuildQuestGoalValidatorService();
    const active = validator.eval({ progress: 40, target: 100 });
    assert.strictEqual(active.done, false);
    assert.strictEqual(active.pct, 40);

    const completed = validator.eval({ progress: 120, target: 100 });
    assert.strictEqual(completed.done, true);
    assert.strictEqual(completed.pct, 100);
  });
});
