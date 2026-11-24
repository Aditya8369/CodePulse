import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ProtobufFrameSplitterService {
  constructor() {
    this.pendingBuffers = new Map();
  }
  pushChunk(socketId, chunk) {
    const existing = this.pendingBuffers.get(socketId);
    const combined = existing ? Buffer.concat([existing, chunk]) : chunk;
    const frames = [];
    let offset = 0;
    while (offset < combined.length) {
      if (combined.length - offset < 4) break;
      const frameLength = combined.readUInt32BE(offset);
      if (combined.length - offset - 4 < frameLength) break;
      frames.push(Buffer.from(combined.subarray(offset + 4, offset + 4 + frameLength)));
      offset += 4 + frameLength;
    }
    if (offset < combined.length) {
      this.pendingBuffers.set(socketId, combined.subarray(offset));
    } else {
      this.pendingBuffers.delete(socketId);
    }
    return frames;
  }
  framePayload(payload) {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length, 0);
    return Buffer.concat([header, payload]);
  }
}

describe('ProtobufFrameSplitterService (#2109)', () => {
  test('reassembles fragmented chunks across socket boundary without buffer corruption', () => {
    const splitter = new ProtobufFrameSplitterService();
    const payload = Buffer.from('hello-protobuf-enterprise-stream');
    const framed = splitter.framePayload(payload);

    // Split frame into two halves
    const part1 = framed.subarray(0, 10);
    const part2 = framed.subarray(10);

    const res1 = splitter.pushChunk('sock-1', part1);
    assert.strictEqual(res1.length, 0);

    const res2 = splitter.pushChunk('sock-1', part2);
    assert.strictEqual(res2.length, 1);
    assert.strictEqual(res2[0].toString(), payload.toString());
  });
});
