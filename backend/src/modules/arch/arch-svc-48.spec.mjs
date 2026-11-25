import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GeoReplicaRouteDirectorService } from './arch-svc-48.service.ts';

describe('GeoReplicaRouteDirectorService (ARCH-SVC-48)', () => {
  it('routes queries to local geo-region read replica', () => {
    const director = new GeoReplicaRouteDirectorService();
    director.registerReplica('us-east-1', 'db-east.internal');
    director.registerReplica('eu-west-1', 'db-eu.internal');

    assert.strictEqual(director.getNearestReplica('eu-west-1')?.host, 'db-eu.internal');
  });
});
