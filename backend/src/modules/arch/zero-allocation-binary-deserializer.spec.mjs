import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ZeroAllocationBinaryDeserializerService {
  decode(buf, offset = 0) {
    if (buf.length < offset + 6) throw new Error('UNDERFLOW');
    const cmd = buf.readUInt16BE(offset);
    const len = buf.readUInt32BE(offset + 2);
    if (buf.length < offset + 6 + len) throw new Error('INCOMPLETE');
    return { cmd, len, slice: buf.subarray(offset + 6, offset + 6 + len) };
  }
}

describe('ZeroAllocationBinaryDeserializerService (#2706)', () => {
  test('decodes binary RPC packets using zero-allocation buffer slicing', () => {
    const deserializer = new ZeroAllocationBinaryDeserializerService();
    const payload = Buffer.from('hello-microservice');
    const buf = Buffer.alloc(6 + payload.length);
    buf.writeUInt16BE(101, 0);
    buf.writeUInt32BE(payload.length, 2);
    payload.copy(buf, 6);

    const packet = deserializer.decode(buf);
    assert.strictEqual(packet.cmd, 101);
    assert.strictEqual(packet.len, payload.length);
    assert.strictEqual(packet.slice.toString(), 'hello-microservice');
  });
});
