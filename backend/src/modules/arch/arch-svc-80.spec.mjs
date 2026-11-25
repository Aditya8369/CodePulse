import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedEventLogCompactionService } from './arch-svc-80.service.ts';

describe('DistributedEventLogCompactionService (ARCH-SVC-80)', () => {
  it('compacts redundant mutation logs keeping only latest state per aggregate field', () => {
    const compactor = new DistributedEventLogCompactionService();
    const raw = [
      { aggregateKey: 'user:1', mutationField: 'name', value: 'Alice', timestamp: 10 },
      { aggregateKey: 'user:1', mutationField: 'email', value: 'a@ex.com', timestamp: 15 },
      { aggregateKey: 'user:1', mutationField: 'name', value: 'Alice Smith', timestamp: 20 },
    ];

    const compacted = compactor.compactLogs(raw);
    assert.strictEqual(compacted.length, 2);
    assert.strictEqual(compacted.find(e => e.mutationField === 'name')?.value, 'Alice Smith');
  });
});
