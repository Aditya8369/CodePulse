import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GrpcChannelMultiplexerService } from './api-int-02.service.ts';

describe('GrpcChannelMultiplexerService (API-INT-02)', () => {
  it('multiplexes frames across channels and enforces flow control window limits', () => {
    const mux = new GrpcChannelMultiplexerService(2);
    mux.registerChannel('ch-1');

    assert.strictEqual(mux.sendFrame('ch-1'), true);
    assert.strictEqual(mux.sendFrame('ch-1'), true);
    assert.strictEqual(mux.sendFrame('ch-1'), false); // window full

    mux.acknowledgeFrame('ch-1');
    assert.strictEqual(mux.sendFrame('ch-1'), true);
  });
});
