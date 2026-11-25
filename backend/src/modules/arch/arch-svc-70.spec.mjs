import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventPayloadCompressionPipelineService } from './arch-svc-70.service.ts';

describe('EventPayloadCompressionPipelineService (ARCH-SVC-70)', () => {
  it('compresses JSON event streams and reconstructs original payloads faithfully', () => {
    const pipeline = new EventPayloadCompressionPipelineService();
    const original = JSON.stringify({ event: 'TEST', metrics: Array(100).fill(42) });

    const compressed = pipeline.compressPayload(original);
    assert.ok(compressed.length < original.length);

    const decompressed = pipeline.decompressPayload(compressed);
    assert.strictEqual(decompressed, original);
  });
});
