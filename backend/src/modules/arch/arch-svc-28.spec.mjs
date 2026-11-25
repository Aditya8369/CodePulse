import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedTracingContextPropagatorService } from './arch-svc-28.service.ts';

describe('DistributedTracingContextPropagatorService (ARCH-SVC-28)', () => {
  it('serializes and deserializes W3C traceparent headers strictly', () => {
    const propagator = new DistributedTracingContextPropagatorService();
    const original = {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: '01',
    };

    const header = propagator.serializeW3C(original);
    assert.strictEqual(header, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

    const parsed = propagator.deserializeW3C(header);
    assert.deepStrictEqual(parsed, original);
  });
});
