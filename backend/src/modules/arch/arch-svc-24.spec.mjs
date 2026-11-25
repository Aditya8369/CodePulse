import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GracefulTeardownManagerService } from './arch-svc-24.service.ts';

describe('GracefulTeardownManagerService (ARCH-SVC-24)', () => {
  it('drains active requests smoothly during teardown', async () => {
    const mgr = new GracefulTeardownManagerService();
    assert.strictEqual(mgr.beginRequest(), true);
    assert.strictEqual(mgr.beginRequest(), true);
    assert.strictEqual(mgr.status.activeRequests, 2);

    let drained = false;
    const teardownPromise = mgr.initiateTeardown().then(() => {
      drained = true;
    });

    // New incoming traffic should be rejected immediately
    assert.strictEqual(mgr.beginRequest(), false);

    mgr.endRequest();
    assert.strictEqual(drained, false);

    mgr.endRequest();
    await teardownPromise;
    assert.strictEqual(drained, true);
    assert.strictEqual(mgr.status.activeRequests, 0);
  });
});
