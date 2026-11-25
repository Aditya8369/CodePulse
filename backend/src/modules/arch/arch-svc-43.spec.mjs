import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HierarchicalConfigProviderService } from './arch-svc-43.service.ts';

describe('HierarchicalConfigProviderService (ARCH-SVC-43)', () => {
  it('manages config key/value hierarchy and dispatches hot-reload notifications', () => {
    const provider = new HierarchicalConfigProviderService();
    let updatedVal = null;

    provider.watchConfig('limits.maxPayload', val => {
      updatedVal = val;
    });

    provider.setConfig('limits.maxPayload', 1048576);
    assert.strictEqual(provider.getConfig('limits.maxPayload'), 1048576);
    assert.strictEqual(updatedVal, 1048576);
  });
});
