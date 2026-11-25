import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HaFailoverSentinelService } from './arch-svc-53.service.ts';

describe('HaFailoverSentinelService (ARCH-SVC-53)', () => {
  it('switches to backup target when consecutive failures breach threshold', () => {
    const sentinel = new HaFailoverSentinelService(3);
    sentinel.registerRoute('auth-api', 'https://primary.auth', 'https://backup.auth');

    assert.strictEqual(sentinel.getActiveTarget('auth-api'), 'https://primary.auth');

    sentinel.recordHealth('auth-api', false);
    sentinel.recordHealth('auth-api', false);
    const transition = sentinel.recordHealth('auth-api', false);

    assert.strictEqual(transition, 'FAILED_OVER');
    assert.strictEqual(sentinel.getActiveTarget('auth-api'), 'https://backup.auth');
  });

  it('fails back to primary target upon health recovery', () => {
    const sentinel = new HaFailoverSentinelService(2);
    sentinel.registerRoute('payment-api', 'https://primary.pay', 'https://backup.pay');

    sentinel.recordHealth('payment-api', false);
    sentinel.recordHealth('payment-api', false);
    assert.strictEqual(sentinel.getActiveTarget('payment-api'), 'https://backup.pay');

    const recovery = sentinel.recordHealth('payment-api', true);
    assert.strictEqual(recovery, 'RECOVERED');
    assert.strictEqual(sentinel.getActiveTarget('payment-api'), 'https://primary.pay');
  });
});
