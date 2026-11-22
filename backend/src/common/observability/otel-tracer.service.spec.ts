import {
  OtelTracerService,
  TraceContextCarrier,
} from './otel-tracer.service';
import { trace } from '@opentelemetry/api';

describe('OtelTracerService Suite', () => {
  let tracerService: OtelTracerService;

  beforeEach(() => {
    tracerService = OtelTracerService.getInstance();
  });

  afterEach(async () => {
    await tracerService.shutdown();
  });

  describe('W3C TraceContext Propagation', () => {
    it('should inject and extract W3C traceparent headers across boundaries', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const incomingCarrier: TraceContextCarrier = {
        traceparent: `00-${traceId}-${spanId}-01`,
        tracestate: 'congo=t61rcWkgMzE',
      };

      // Extract context
      const extractedContext = tracerService.extractContext(incomingCarrier);
      expect(extractedContext).toBeDefined();

      // Start a child span using extracted context
      const span = tracerService.getTracer().startSpan('test_child_operation', undefined, extractedContext);
      const spanContext = span.spanContext();

      // Trace ID should propagate across the boundary
      expect(spanContext.traceId).toBe(traceId);
      expect(spanContext.spanId).not.toBe(spanId);

      // Inject into outgoing carrier
      const outgoingCarrier: TraceContextCarrier = {};
      tracerService.injectContext(trace.setSpan(extractedContext, span), outgoingCarrier);

      expect(outgoingCarrier.traceparent).toBeDefined();
      expect(outgoingCarrier.traceparent).toContain(traceId);
      span.end();
    });

    it('should parse trace info correctly from carriers', () => {
      const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const spanId = '1234567890abcdef';
      const carrier: TraceContextCarrier = {
        traceparent: `00-${traceId}-${spanId}-01`,
      };

      const info = tracerService.getTraceInfo(carrier);
      expect(info.traceId).toBe(traceId);
      expect(info.spanId).toBe(spanId);
      expect(info.traceFlags).toBe(1);
      expect(info.traceparent).toBe(carrier.traceparent);
    });
  });

  describe('BullMQ Trace Propagation', () => {
    it('should inject trace context into BullMQ job payload', () => {
      const jobPayload = { battleId: 'battle-123', userId: 'user-456' };
      const enrichedPayload = tracerService.injectJobTraceData(jobPayload);

      expect(enrichedPayload.battleId).toBe('battle-123');
      expect(enrichedPayload.userId).toBe('user-456');
      expect(enrichedPayload._traceContext).toBeDefined();
    });

    it('should execute BullMQ job handler under propagated trace context', async () => {
      const traceId = '5c8a0026e6e04b408169a88ff9f5d342';
      const spanId = 'b7ad6b7169203331';
      const mockJob = {
        name: 'sync_user_xp',
        id: 'job-999',
        data: {
          _traceContext: {
            traceparent: `00-${traceId}-${spanId}-01`,
          },
        },
      };

      let executedTraceId: string | undefined;

      await tracerService.runWithJobTrace(mockJob, async (span) => {
        executedTraceId = span.spanContext().traceId;
        return { success: true };
      });

      expect(executedTraceId).toBe(traceId);
    });
  });

  describe('Subprocess Execution Runner Profiling', () => {
    it('should measure compile vs test evaluation time within custom spans', async () => {
      const compileResult = await tracerService.measureExecutionSubprocess(
        'compile',
        { language: 'typescript', submissionId: 'sub-101' },
        async () => {
          await new Promise((r) => setTimeout(r, 20));
          return { compiled: true };
        },
      );

      expect(compileResult.compiled).toBe(true);

      const testResult = await tracerService.measureExecutionSubprocess(
        'test_eval',
        { language: 'typescript', submissionId: 'sub-101' },
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { passed: 5, total: 5 };
        },
      );

      expect(testResult.passed).toBe(5);
    });
  });

  describe('Sampling Rate Configuration', () => {
    it('should configure 100% sampling for development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.OTEL_SAMPLE_RATE;

      const sampler = OtelTracerService.getSampler();
      expect(sampler.toString()).toContain('AlwaysOnSampler');

      process.env.NODE_ENV = originalEnv;
    });

    it('should configure adaptive sampling for production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.OTEL_SAMPLE_RATE;

      const sampler = OtelTracerService.getSampler();
      expect(sampler.toString()).toContain('TraceIdRatioBased');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
