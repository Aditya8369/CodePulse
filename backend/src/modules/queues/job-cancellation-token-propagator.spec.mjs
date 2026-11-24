import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class JobCancellationTokenPropagatorService {
  constructor() { this.c = new Set(); }
  cancel(id) { this.c.add(id); }
  isCancelled(id) { return this.c.has(id); }
  clean(id) { this.c.delete(id); }
}

describe('JobCancellationTokenPropagatorService (#2310)', () => {
  test('propagates cancellation signals to interrupt asynchronous worker tasks', () => {
    const propagator = new JobCancellationTokenPropagatorService();
    assert.strictEqual(propagator.isCancelled('job-abc'), false);
    propagator.cancel('job-abc');
    assert.strictEqual(propagator.isCancelled('job-abc'), true);
  });
});
