import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AutomatedDlqReprocessorService } from './arch-svc-29.service.ts';

describe('AutomatedDlqReprocessorService (ARCH-SVC-29)', () => {
  it('calculates exponential jitter backoff bounded by maxBackoff', () => {
    const svc = new AutomatedDlqReprocessorService(1000, 10000);
    const delay0 = svc.calculateBackoffDelay(0);
    assert.ok(delay0 >= 500 && delay0 <= 1000);

    const delayLarge = svc.calculateBackoffDelay(10);
    assert.ok(delayLarge <= 10000);
  });
});
