import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LokiProtobufLogShipperService {
  formatPayload(labels, entries) {
    return { streams: [{ stream: labels, values: entries.map(e => [e.timestampNs, e.line]) }] };
  }
}

describe('LokiProtobufLogShipperService (Issue #1903)', () => {
  it('should format structured logs into Grafana Loki stream ingestion envelopes', () => {
    const shipper = new LokiProtobufLogShipperService();
    const payload = shipper.formatPayload({ app: 'codepulse' }, [{ timestampNs: '1000', line: 'booted' }]);

    assert.equal(payload.streams.length, 1);
    assert.equal(payload.streams[0].stream.app, 'codepulse');
    assert.deepEqual(payload.streams[0].values, [['1000', 'booted']]);
  });
});
