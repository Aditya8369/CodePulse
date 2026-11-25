import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ServiceDiscoveryWatchdogService } from './arch-svc-26.service.ts';

describe('ServiceDiscoveryWatchdogService (ARCH-SVC-26)', () => {
  it('registers instances and tracks heartbeats', () => {
    const watchdog = new ServiceDiscoveryWatchdogService(5000);
    watchdog.register('auth-svc', 'auth-1', '10.0.0.1', 8080);
    assert.strictEqual(watchdog.getHealthyInstances('auth-svc').length, 1);
  });

  it('automatically purges unresponsive instances beyond heartbeat TTL', () => {
    const watchdog = new ServiceDiscoveryWatchdogService(5000);
    watchdog.register('billing-svc', 'bill-1', '10.0.0.2', 8081);

    const purged = watchdog.purgeStaleInstances(Date.now() + 6000);
    assert.deepStrictEqual(purged, ['bill-1']);
    assert.strictEqual(watchdog.getHealthyInstances('billing-svc').length, 0);
  });
});
