import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CrossDatacenterReplicationService } from './arch-svc-12.service.ts';

describe('CrossDatacenterReplicationService (ARCH-SVC-12)', () => {
  it('increments local vector clock on local mutations', () => {
    const dcEast = new CrossDatacenterReplicationService('us-east');
    const r1 = dcEast.putLocal('user:101', { name: 'Alice' });
    assert.strictEqual(r1.clock['us-east'], 1);

    const r2 = dcEast.putLocal('user:101', { name: 'Alice B' });
    assert.strictEqual(r2.clock['us-east'], 2);
  });

  it('replicates causal updates that dominate existing clocks', () => {
    const dcEast = new CrossDatacenterReplicationService('us-east');
    dcEast.putLocal('cfg:timeout', 5000);

    const replicated = dcEast.receiveReplication({
      key: 'cfg:timeout',
      value: 10000,
      clock: { 'us-east': 2, 'eu-central': 1 },
      updatedAt: Date.now() + 100,
      originDc: 'eu-central'
    });

    assert.strictEqual(replicated.applied, true);
    assert.strictEqual(dcEast.getRecord('cfg:timeout')?.value, 10000);
  });

  it('resolves concurrent conflicts deterministically via LWW and clock merge', () => {
    const dcEast = new CrossDatacenterReplicationService('us-east');
    dcEast.putLocal('balance:1', 100);

    const res = dcEast.receiveReplication({
      key: 'balance:1',
      value: 150,
      clock: { 'eu-central': 2 },
      updatedAt: Date.now() + 500,
      originDc: 'eu-central'
    });

    assert.strictEqual(res.applied, true);
    assert.strictEqual(res.resolution, 'CONCURRENT_LWW_ACCEPTED');
    assert.strictEqual(dcEast.getRecord('balance:1')?.clock['us-east'], 1);
    assert.strictEqual(dcEast.getRecord('balance:1')?.clock['eu-central'], 2);
  });
});
