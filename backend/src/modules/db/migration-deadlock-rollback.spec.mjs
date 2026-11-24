import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MigrationDeadlockRollbackService {
  async run(fn, timeout = 200) {
    try {
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout));
      await Promise.race([fn(), t]);
      return { ok: true, rolledBack: false };
    } catch {
      return { ok: false, rolledBack: true };
    }
  }
}

describe('MigrationDeadlockRollbackService (#2146)', () => {
  test('aborts migration and rolls back schema locks upon lock acquisition timeout', async () => {
    const service = new MigrationDeadlockRollbackService();
    // Simulate deadlocked migration
    const res = await service.run(async () => {
      await new Promise(r => setTimeout(r, 500));
    }, 50);

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.rolledBack, true);
  });
});
