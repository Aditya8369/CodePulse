import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as zlib from 'zlib';

class AggregateStateRehydrationCompressorService {
  compress(obj) {
    return zlib.deflateSync(Buffer.from(JSON.stringify(obj)));
  }
  decompress(buf) {
    return JSON.parse(zlib.inflateSync(buf).toString());
  }
}

describe('AggregateStateRehydrationCompressorService (#2708)', () => {
  test('compresses aggregate snapshots and restores exact state upon rehydration', () => {
    const service = new AggregateStateRehydrationCompressorService();
    const state = { aggregateId: 'agg-101', version: 450, balances: { userA: 500, userB: 1200 } };

    const compressed = service.compress(state);
    assert.ok(compressed.length > 0);

    const rehydrated = service.decompress(compressed);
    assert.deepStrictEqual(rehydrated, state);
  });
});
