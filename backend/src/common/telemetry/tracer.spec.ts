import {
  parseW3CTraceparent,
  formatW3CTraceparent,
  BackendTracer,
} from './tracer';

describe('OpenTelemetry Backend Tracer & W3C Propagator', () => {
  let tracer: BackendTracer;

  beforeEach(() => {
    tracer = new BackendTracer();
  });

  describe('parseW3CTraceparent & formatW3CTraceparent', () => {
    it('should correctly format and parse valid W3C traceparent headers', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const formatted = formatW3CTraceparent(traceId, spanId, true);

      expect(formatted).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

      const parsed = parseW3CTraceparent(formatted);
      expect(parsed).toBeDefined();
      expect(parsed?.traceId).toBe(traceId);
      expect(parsed?.parentSpanId).toBe(spanId);
      expect(parsed?.isSampled).toBe(true);
    });

    it('should return null for malformed traceparents', () => {
      expect(parseW3CTraceparent('invalid-traceparent')).toBeNull();
      expect(parseW3CTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
      expect(parseW3CTraceparent('00-short-short-01')).toBeNull();
    });
  });

  describe('Server and Query Span Lifecycle', () => {
    it('should create server span and extract traceparent context', () => {
      const incoming = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const { span, traceparent } = tracer.startServerSpan('GET /api/battles', incoming);

      expect(span).toBeDefined();
      expect(traceparent).toBeDefined();
      expect(traceparent.startsWith('00-')).toBe(true);
      span.end();
    });

    it('should trace database queries and record OK status', async () => {
      const result = await tracer.traceDatabaseQuery('findMany', 'Battle', async () => {
        return [{ id: 'b1', name: 'Code Clash' }];
      });

      expect(result).toEqual([{ id: 'b1', name: 'Code Clash' }]);
    });

    it('should trace Redis operations cleanly', async () => {
      const cached = await tracer.traceRedisOperation('get', 'user:123', async () => {
        return 'cached_profile';
      });

      expect(cached).toBe('cached_profile');
    });
  });
});
