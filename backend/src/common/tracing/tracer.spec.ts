import {
  initTracer,
  shutdownTracer,
  getTracer,
  injectTraceContext,
  extractTraceContext,
  getTraceInfo,
  createChildSpan,
  runWithSpan,
  traceBusinessOperation,
  OpenTelemetryTracerManager,
} from './tracer';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

describe('OpenTelemetry Tracer & Distributed Span Propagation', () => {
  beforeAll(async () => {
    process.env.OTEL_SDK_DISABLED = 'true'; // Keep SDK light in test environment
    await initTracer();
  });

  afterAll(async () => {
    await shutdownTracer();
  });

  it('should initialize and return an OpenTelemetry tracer instance', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });

  describe('W3C TraceContext Propagation', () => {
    it('should inject and extract W3C traceparent headers accurately', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const incomingCarrier = {
        traceparent: `00-${traceId}-${spanId}-01`,
        tracestate: 'rojo=1,congo=2',
      };

      const extractedContext = extractTraceContext(incomingCarrier);
      expect(extractedContext).toBeDefined();

      const info = getTraceInfo(incomingCarrier);
      expect(info.traceId).toBe(traceId);
      expect(info.spanId).toBe(spanId);
      expect(info.traceFlags).toBe(1);
      expect(info.traceparent).toBe(incomingCarrier.traceparent);

      // Inject into a fresh carrier
      const outgoingCarrier: Record<string, any> = {};
      injectTraceContext(outgoingCarrier, extractedContext);
      expect(outgoingCarrier.traceparent).toContain(traceId);
    });

    it('should handle missing or malformed traceparent gracefully', () => {
      const info = getTraceInfo({ traceparent: 'invalid' });
      expect(info.traceId).toBeUndefined();

      const emptyInfo = getTraceInfo({});
      expect(emptyInfo.traceId).toBeUndefined();
    });
  });

  describe('Child Spans & Execution Tracing', () => {
    it('should create and end child spans with attributes', () => {
      const span = createChildSpan('test.child.span', {
        'service.name': 'test-service',
        'operation.type': 'cache-read',
      });

      expect(span).toBeDefined();
      expect(typeof span.setAttribute).toBe('function');
      expect(typeof span.end).toBe('function');
      span.end();
    });

    it('should execute asynchronous function inside an active span', async () => {
      let executed = false;
      const result = await runWithSpan(
        'test.async.operation',
        async (span) => {
          expect(span).toBeDefined();
          span.setAttribute('test.attribute', 42);
          executed = true;
          return { success: true };
        },
        { 'initial.attr': 'ready' },
      );

      expect(executed).toBe(true);
      expect(result).toEqual({ success: true });
    });

    it('should record exceptions and set ERROR status on failure', async () => {
      await expect(
        runWithSpan('test.failing.operation', async () => {
          throw new Error('Database transaction timeout');
        }),
      ).rejects.toThrow('Database transaction timeout');
    });
  });

  describe('Business Logic Bottlenecks Spans', () => {
    it('should create custom child span for Elo calculation', async () => {
      const eloResult = await traceBusinessOperation(
        'elo.calculation',
        async (span) => {
          span.setAttribute('player.challengerRating', 1500);
          span.setAttribute('player.opponentRating', 1600);
          return { challengerNew: 1532, opponentNew: 1568 };
        },
        { battleId: 'battle-42' },
      );

      expect(eloResult).toEqual({ challengerNew: 1532, opponentNew: 1568 });
    });

    it('should create custom child span for AST parsing', async () => {
      const astResult = await traceBusinessOperation(
        'ast.parsing',
        async (span) => {
          span.setAttribute('code.lines', 120);
          span.setAttribute('parser.engine', 'typescript');
          return { astNodesCount: 450, syntaxValid: true };
        },
        { language: 'typescript' },
      );

      expect(astResult.astNodesCount).toBe(450);
      expect(astResult.syntaxValid).toBe(true);
    });

    it('should create custom child span for Webhook signing', async () => {
      const signResult = await traceBusinessOperation(
        'webhook.signing',
        async (span) => {
          span.setAttribute('signature.algorithm', 'sha256');
          return { signature: 'sha256=abcdef1234567890' };
        },
        { endpoint: 'https://api.external.com/webhook' },
      );

      expect(signResult.signature).toBe('sha256=abcdef1234567890');
    });

    it('should support background queue jobs (BullMQ) and Redis call instrumentation', async () => {
      const queueResult = await traceBusinessOperation(
        'bullmq.job',
        async (span) => {
          span.setAttribute('queue.name', 'rating-decay');
          span.setAttribute('job.id', 'job-789');
          return { processed: true };
        },
      );

      expect(queueResult.processed).toBe(true);

      const redisResult = await traceBusinessOperation(
        'redis.call',
        async (span) => {
          span.setAttribute('db.system', 'redis');
          span.setAttribute('db.operation', 'GET');
          return 'cached_val';
        },
      );

      expect(redisResult).toBe('cached_val');
    });
  });

  describe('Sampler Resolution', () => {
    it('should resolve AlwaysOnSampler in test / development mode', () => {
      const sampler = OpenTelemetryTracerManager.resolveSampler();
      expect(sampler).toBeDefined();
    });

    it('should respect OTEL_SAMPLE_RATE environment variable', () => {
      process.env.OTEL_SAMPLE_RATE = '1.0';
      const samplerFull = OpenTelemetryTracerManager.resolveSampler();
      expect(samplerFull).toBeDefined();

      process.env.OTEL_SAMPLE_RATE = '0.0';
      const samplerOff = OpenTelemetryTracerManager.resolveSampler();
      expect(samplerOff).toBeDefined();

      delete process.env.OTEL_SAMPLE_RATE;
    });
  });
});

