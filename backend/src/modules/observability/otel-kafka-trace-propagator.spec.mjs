import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class OTelKafkaTracePropagatorService {
  inject(headers, ctx) {
    const res = { ...headers, traceparent: ctx.traceparent };
    if (ctx.baggage) res.baggage = Object.entries(ctx.baggage).map(([k,v]) => k+'='+v).join(',');
    return res;
  }
  extract(headers) {
    if (!headers.traceparent) return null;
    const bag = {};
    if (headers.baggage) headers.baggage.split(',').forEach(p => { const [k,v] = p.split('='); bag[k]=v; });
    return { traceparent: headers.traceparent, baggage: bag };
  }
}

describe('OTelKafkaTracePropagatorService (Issue #1891)', () => {
  it('should inject and extract W3C distributed traceparent and baggage headers', () => {
    const propagator = new OTelKafkaTracePropagatorService();
    const ctx = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', baggage: { userId: '123' } };

    const injected = propagator.inject({}, ctx);
    assert.equal(injected.traceparent, ctx.traceparent);

    const extracted = propagator.extract(injected);
    assert.equal(extracted.traceparent, ctx.traceparent);
    assert.equal(extracted.baggage.userId, '123');
  });
});
