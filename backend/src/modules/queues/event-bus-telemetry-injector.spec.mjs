import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventBusTelemetryInjectorService {
  inject(h, trace, span, tenant) {
    const traceparent = `00-${trace}-${span}-01`;
    const res = { ...h, traceparent };
    if (tenant) res.baggage = `tenant=${tenant}`;
    return res;
  }
  extract(h) {
    if (!h.traceparent) return null;
    return h.traceparent.split('-')[1] || null;
  }
}

describe('EventBusTelemetryInjectorService (#2313)', () => {
  test('injects W3C traceparent and baggage into messaging headers for distributed tracing', () => {
    const injector = new EventBusTelemetryInjectorService();
    const headers = injector.inject({}, '4bf92f3577b34da6a3ce929d0e0e4736', '00f067aa0ba902b7', 'tenant-corp');
    assert.strictEqual(headers.traceparent, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    assert.strictEqual(headers.baggage, 'tenant=tenant-corp');
    assert.strictEqual(injector.extract(headers), '4bf92f3577b34da6a3ce929d0e0e4736');
  });
});
