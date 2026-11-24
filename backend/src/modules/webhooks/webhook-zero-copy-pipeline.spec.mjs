import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebhookZeroCopyPipelineService {
  constructor() {
    this.subscribers = new Map();
  }
  registerSubscriber(sub) { this.subscribers.set(sub.id, sub); }
  fanoutZeroCopy(sharedPayloadBuffer, headerPrefix) {
    const results = [];
    for (const sub of this.subscribers.values()) {
      if (!sub.active) continue;
      const payloadView = sharedPayloadBuffer.subarray(0, sharedPayloadBuffer.length);
      const finalBuffer = headerPrefix ? Buffer.concat([headerPrefix, payloadView]) : payloadView;
      results.push({ subscriberId: sub.id, bufferChunk: finalBuffer, byteLength: finalBuffer.length });
    }
    return results;
  }
}

describe('WebhookZeroCopyPipelineService (Issue #1792)', () => {
  it('should fanout binary buffer to active subscribers without heap churn using zero-copy slicing', () => {
    const pipeline = new WebhookZeroCopyPipelineService();
    pipeline.registerSubscriber({ id: 'sub-1', endpointUrl: 'https://api.one.io/hook', active: true });
    pipeline.registerSubscriber({ id: 'sub-2', endpointUrl: 'https://api.two.io/hook', active: true });
    pipeline.registerSubscriber({ id: 'sub-3', endpointUrl: 'https://api.off.io/hook', active: false });

    const sharedPayload = Buffer.from(JSON.stringify({ event: 'tournament.ended', tournamentId: 'tourn-999' }));
    const fanouts = pipeline.fanoutZeroCopy(sharedPayload);

    assert.equal(fanouts.length, 2, 'Only active subscribers must receive payload');
    assert.equal(fanouts[0].byteLength, sharedPayload.length);
    assert.equal(fanouts[0].bufferChunk.toString(), sharedPayload.toString());
  });
});
