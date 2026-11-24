import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DeadlockRetryInterceptorService {
  async executeWithDeadlockRetry(action, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await action();
        return { success: true, data: res, retries: i };
      } catch (e) {
        if (e.code !== '40P01' || i === maxRetries - 1) throw e;
      }
    }
  }
}

describe('DeadlockRetryInterceptorService (Issue #1829)', () => {
  it('should catch 40P01 deadlocks and transparently retry until success', async () => {
    const interceptor = new DeadlockRetryInterceptorService();
    let tries = 0;
    const action = async () => {
      tries++;
      if (tries === 1) {
        const err = new Error('deadlock detected');
        err.code = '40P01';
        throw err;
      }
      return 'saved';
    };

    const res = await interceptor.executeWithDeadlockRetry(action, 3);
    assert.equal(res.success, true);
    assert.equal(res.data, 'saved');
    assert.equal(res.retries, 1);
  });
});
