import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ZeroAllocationByteBufferSerializer } from './arch-svc-47.service.ts';

describe('ZeroAllocationByteBufferSerializer (ARCH-SVC-47)', () => {
  it('serializes integers and strings into reusable contiguous byte buffers', () => {
    const ser = new ZeroAllocationByteBufferSerializer();
    ser.writeString('ping');
    const out = ser.getWrittenBuffer();

    assert.strictEqual(out.readUInt32BE(0), 4);
    assert.strictEqual(out.subarray(4, 8).toString('utf8'), 'ping');
  });
});
