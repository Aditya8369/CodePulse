import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RocksDbCheckpointCoordinatorService } from './arch-svc-72.service.ts';

describe('RocksDbCheckpointCoordinatorService (ARCH-SVC-72)', () => {
  it('creates atomic metadata checkpoints of active state memory without blocking writes', () => {
    const coord = new RocksDbCheckpointCoordinatorService();
    coord.put('k1', 'v1');
    coord.put('k2', 'v2');

    const chk1 = coord.createNonBlockingCheckpoint();
    assert.strictEqual(chk1.dataCount, 2);
    assert.strictEqual(chk1.sequenceNumber, 2);

    coord.put('k3', 'v3');
    assert.strictEqual(coord.getSnapshots().length, 1);
  });
});
