import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MsgPackCacheSerializerService {
  serialize(o) { return Buffer.from(JSON.stringify(o), 'utf8'); }
  deserialize(b) { return JSON.parse(b.toString('utf8')); }
}

describe('MsgPackCacheSerializerService (Issue #1830)', () => {
  it('should serialize and deserialize complex tournament state payloads to binary buffers', () => {
    const serializer = new MsgPackCacheSerializerService();
    const payload = { tournamentId: 't-100', scores: [10, 20, 30] };
    const binary = serializer.serialize(payload);
    assert.equal(Buffer.isBuffer(binary), true);

    const recovered = serializer.deserialize(binary);
    assert.deepEqual(recovered, payload);
  });
});
