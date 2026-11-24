import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ZeroCopyBufferSplicerService {
  splice(buf, hLen) {
    if (buf.length < hLen) throw new Error('Too short');
    return { header: buf.subarray(0, hLen), payload: buf.subarray(hLen) };
  }
  fanout(payload, count) {
    const views = [];
    for (let i = 0; i < count; i++) views.push(payload.subarray());
    return views;
  }
}

describe('ZeroCopyBufferSplicerService (#2297)', () => {
  test('splices binary streams using zero-copy memory references', () => {
    const splicer = new ZeroCopyBufferSplicerService();
    const raw = Buffer.from('HEAD1234PAYLOAD_BODY_DATA');
    const { header, payload } = splicer.splice(raw, 8);
    assert.strictEqual(header.toString('utf8'), 'HEAD1234');
    assert.strictEqual(payload.toString('utf8'), 'PAYLOAD_BODY_DATA');

    const fanout = splicer.fanout(payload, 3);
    assert.strictEqual(fanout.length, 3);
    assert.strictEqual(fanout[0].toString('utf8'), 'PAYLOAD_BODY_DATA');
  });
});
