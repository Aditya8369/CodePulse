import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BullmqTraceContextPropagatorService {
  wrap(data, traceId) {
    return { data, traceId };
  }
}

describe('BullmqTraceContextPropagatorService (#2250)', () => {
  test('binds trace context to asynchronous BullMQ job payloads', () => {
    const prop = new BullmqTraceContextPropagatorService();
    const job = prop.wrap({ foo: 'bar' }, 'trace-999');
    assert.strictEqual(job.traceId, 'trace-999');
    assert.strictEqual(job.data.foo, 'bar');
  });
});
