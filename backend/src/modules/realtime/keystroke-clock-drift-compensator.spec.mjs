import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KeystrokeClockDriftCompensatorService {
  constructor() {
    this.clientDriftOffsets = new Map();
  }
  processClockSync(clientId, packet) {
    const clockOffset = ((packet.serverReceiveTime - packet.clientSendTime) + (packet.serverReplyTime - packet.clientReceiveTime)) / 2;
    this.clientDriftOffsets.set(clientId, clockOffset);
    return { offsetMs: clockOffset };
  }
  compensateKeystroke(clientId, event) {
    const offset = this.clientDriftOffsets.get(clientId) || 0;
    return { ...event, correctedTimestamp: event.clientTimestamp + offset };
  }
}

describe('KeystrokeClockDriftCompensatorService (#2108)', () => {
  test('estimates Cristian clock offset and aligns client keystrokes within sub-10ms bounds', () => {
    const service = new KeystrokeClockDriftCompensatorService();
    // Client clock is 50ms behind server
    service.processClockSync('client-1', {
      clientSendTime: 1000,
      serverReceiveTime: 1060,
      serverReplyTime: 1062,
      clientReceiveTime: 1022,
    });

    const event = service.compensateKeystroke('client-1', { keyId: 'k1', clientTimestamp: 2000, keystroke: 'const x = 1;' });
    assert.strictEqual(event.correctedTimestamp, 2050);
  });
});
