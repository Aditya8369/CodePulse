import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BlueGreenRouteResharderService } from './arch-svc-16.service.ts';

describe('BlueGreenRouteResharderService (ARCH-SVC-16)', () => {
  it('registers connection routes deterministically to active blue cluster', () => {
    const resharder = new BlueGreenRouteResharderService(8);
    const route = resharder.registerConnection('ws-client-99');
    assert.strictEqual(route.cluster, 'BLUE');
    assert.strictEqual(route.migrating, false);
    assert.ok(route.shardIndex >= 0 && route.shardIndex < 8);
  });

  it('triggers blue-green switchover and handles zero-downtime connection draining migration', () => {
    const resharder = new BlueGreenRouteResharderService(8);
    resharder.registerConnection('ws-client-1');

    const nextCluster = resharder.triggerSwitchover();
    assert.strictEqual(nextCluster, 'GREEN');

    resharder.markMigrating('ws-client-1');
    assert.strictEqual(resharder.getRoute('ws-client-1')?.migrating, true);

    resharder.completeMigration('ws-client-1');
    assert.strictEqual(resharder.getRoute('ws-client-1')?.cluster, 'GREEN');
    assert.strictEqual(resharder.getRoute('ws-client-1')?.migrating, false);
  });
});
