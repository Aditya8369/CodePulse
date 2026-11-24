import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CrossDcMirrorService {
  constructor(localDc, maxHops = 3) {
    this.localDc = localDc;
    this.maxHops = maxHops;
  }
  processIncomingRecord(record) {
    if (record.headers.visitedDcs.includes(this.localDc)) {
      return { shouldMirror: false, reason: 'Circular loop' };
    }
    if (record.headers.hopCount >= this.maxHops) {
      return { shouldMirror: false, reason: 'Max hops' };
    }
    return {
      shouldMirror: true,
      mirroredRecord: {
        ...record,
        headers: {
          ...record.headers,
          visitedDcs: [...record.headers.visitedDcs, this.localDc],
          hopCount: record.headers.hopCount + 1
        }
      }
    };
  }
  createOutboundRecord(id, topic, payload) {
    return { id, topic, payload, headers: { originDc: this.localDc, visitedDcs: [this.localDc], hopCount: 0 } };
  }
}

describe('CrossDcMirrorService (Issue #1419)', () => {
  it('should replicate record between DCs and enrich visited DC provenance headers', () => {
    const dcEast = new CrossDcMirrorService('dc-us-east');
    const dcWest = new CrossDcMirrorService('dc-us-west');

    const original = dcEast.createOutboundRecord('evt-1', 'player-stats', { xp: 100 });
    assert.deepEqual(original.headers.visitedDcs, ['dc-us-east']);

    const mirroredToWest = dcWest.processIncomingRecord(original);
    assert.equal(mirroredToWest.shouldMirror, true);
    assert.deepEqual(mirroredToWest.mirroredRecord.headers.visitedDcs, ['dc-us-east', 'dc-us-west']);
    assert.equal(mirroredToWest.mirroredRecord.headers.hopCount, 1);
  });

  it('should detect and drop circular replication loop preventing infinite mirroring', () => {
    const dcEast = new CrossDcMirrorService('dc-us-east');
    const loopedRecord = {
      id: 'evt-loop',
      topic: 'telemetry',
      payload: {},
      headers: {
        originDc: 'dc-us-east',
        visitedDcs: ['dc-us-east', 'dc-eu-west', 'dc-ap-south'],
        hopCount: 2
      }
    };

    // East DC receives its own record back
    const result = dcEast.processIncomingRecord(loopedRecord);
    assert.equal(result.shouldMirror, false);
    assert.equal(result.reason, 'Circular loop');
  });
});
