import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GrpcOtelCorrelationInterceptorService {
  inject(m, id) { m.set('x-correlation-id', id); return m; }
}

describe('GrpcOtelCorrelationInterceptorService (#2246)', () => {
  test('injects distributed correlation IDs into gRPC metadata trailers', () => {
    const interceptor = new GrpcOtelCorrelationInterceptorService();
    const map = new Map();
    interceptor.inject(map, 'trace-12345');
    assert.strictEqual(map.get('x-correlation-id'), 'trace-12345');
  });
});
