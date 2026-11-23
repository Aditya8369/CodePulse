import { describe, it, expect } from 'vitest';
import { DeadlockResolverService } from './deadlock-resolver.service';

describe('DeadlockResolverService Concurrency Simulation (Vitest)', () => {
  it('resolves simulated concurrent conflicting match conclusion transactions without failure', async () => {
    const resolver = new DeadlockResolverService();
    let sharedBalance = 100;
    let conflictInjected = false;

    const workerA = resolver.executeWithDeadlockRetry(
      async () => {
        if (!conflictInjected) {
          conflictInjected = true;
          const err: any = new Error('ERROR: deadlock detected (40P01)');
          err.code = '40P01';
          throw err;
        }
        sharedBalance += 25;
        return 'workerA-ok';
      },
      { baseDelayMs: 2, maxDelayMs: 8 },
    );

    const workerB = resolver.executeWithDeadlockRetry(
      async () => {
        sharedBalance += 50;
        return 'workerB-ok';
      },
      { baseDelayMs: 2, maxDelayMs: 8 },
    );

    const [resA, resB] = await Promise.all([workerA, workerB]);
    expect(resA).toBe('workerA-ok');
    expect(resB).toBe('workerB-ok');
    expect(sharedBalance).toBe(175);
  });
});
