import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class NoisyNeighborMitigatingSchedulerService {
  schedule(w, clusterLoad) {
    if (clusterLoad > 80 && w.cpu > 40) {
      return { ok: true, delay: 500, prio: 'THROTTLED' };
    }
    return { ok: true, delay: 0, prio: 'NORMAL' };
  }
}

describe('NoisyNeighborMitigatingSchedulerService (#2405)', () => {
  test('dynamically deprioritizes noisy neighbor tenants during cluster saturation', () => {
    const scheduler = new NoisyNeighborMitigatingSchedulerService();
    const normal = scheduler.schedule({ cpu: 20 }, 50);
    assert.strictEqual(normal.prio, 'NORMAL');
    assert.strictEqual(normal.delay, 0);

    const noisy = scheduler.schedule({ cpu: 60 }, 85);
    assert.strictEqual(noisy.prio, 'THROTTLED');
    assert.strictEqual(noisy.delay, 500);
  });
});
