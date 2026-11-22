import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  Tracer,
  ROOT_CONTEXT,
  Context,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
  TracerProvider,
} from '@opentelemetry/sdk-trace';

// Ensure global W3C TraceContext propagator is registered
try {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
} catch {
  // Already registered or initialized
}

export interface TraceContextCarrier {
  traceparent?: string;
  tracestate?: string;
  [key: string]: unknown;
}

export interface ExtractedTraceContext {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  traceparent?: string;
}

export class OtelTracerService {
  private static instance: OtelTracerService;
  private sdk: NodeSDK | null = null;
  private tracerProvider: TracerProvider | null = null;
  private tracer: Tracer;
  private isInitialized = false;

  constructor() {
    this.ensureTracerProvider();
    this.tracer = trace.getTracer('codepulse-tracer', '1.0.0');
  }

  private ensureTracerProvider(): void {
    if (!this.tracerProvider) {
      this.tracerProvider = new TracerProvider({
        sampler: OtelTracerService.getSampler(),
      });
      try {
        trace.setGlobalTracerProvider(this.tracerProvider);
      } catch {
        // Global provider may already be registered
      }
    }
  }

  public static getInstance(): OtelTracerService {
    if (!OtelTracerService.instance) {
      OtelTracerService.instance = new OtelTracerService();
    }
    return OtelTracerService.instance;
  }

  /**
   * Configures sampling rate:
   * - 100% (AlwaysOnSampler) in development/test or if OTEL_SAMPLE_RATE=1.0
   * - Adaptive/Head-based Ratio Sampler (default 10% in production, or OTEL_SAMPLE_RATE)
   */
  public static getSampler() {
    const isProd = process.env.NODE_ENV === 'production';
    const envRatio = process.env.OTEL_SAMPLE_RATE
      ? parseFloat(process.env.OTEL_SAMPLE_RATE)
      : undefined;

    if (envRatio !== undefined) {
      if (envRatio >= 1.0) return new AlwaysOnSampler();
      if (envRatio <= 0.0) return new AlwaysOffSampler();
      return new TraceIdRatioBasedSampler(envRatio);
    }

    if (!isProd) {
      return new AlwaysOnSampler();
    }

    // Default 10% adaptive head-based sampling in production
    return new TraceIdRatioBasedSampler(0.1);
  }

  /**
   * Initializes OpenTelemetry NodeSDK with auto-instrumentations
   * and OTLP exporter for Jaeger / Tempo / Grafana Cloud.
   */
  public async initSdk(): Promise<void> {
    if (this.isInitialized || process.env.OTEL_SDK_DISABLED === 'true') {
      return;
    }

    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

    const traceExporter = new OTLPTraceExporter({
      url: otlpEndpoint,
    });

    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || 'codepulse-backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || 'development',
    });

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      sampler: OtelTracerService.getSampler(),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // avoid noisy file system spans
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
        }),
      ],
    });

    try {
      this.sdk.start();
      this.isInitialized = true;
      this.tracer = trace.getTracer('codepulse-tracer', '1.0.0');
    } catch (err) {
      console.warn('Failed to start OpenTelemetry NodeSDK:', err);
    }
  }

  /**
   * Graceful shutdown of OpenTelemetry SDK
   */
  public async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.isInitialized = false;
      } catch (err) {
        console.warn('Error during OpenTelemetry SDK shutdown:', err);
      }
    }
  }

  /**
   * Returns current active Tracer
   */
  public getTracer(): Tracer {
    return this.tracer || trace.getTracer('codepulse-tracer', '1.0.0');
  }

  /**
   * Extracts W3C TraceContext from carrier headers/map
   */
  public extractContext(carrier: TraceContextCarrier): Context {
    return propagation.extract(context.active(), carrier);
  }

  /**
   * Injects current or provided context into carrier headers/map
   */
  public injectContext(
    activeContext: Context = context.active(),
    carrier: TraceContextCarrier = {},
  ): TraceContextCarrier {
    propagation.inject(activeContext, carrier);
    return carrier;
  }

  /**
   * Extracts traceId, spanId, and traceparent string from carrier or active context
   */
  public getTraceInfo(carrier?: TraceContextCarrier): ExtractedTraceContext {
    const ctx = carrier ? this.extractContext(carrier) : context.active();
    const span = trace.getSpan(ctx);

    if (span) {
      const spanContext = span.spanContext();
      const traceFlags = spanContext.traceFlags.toString(16).padStart(2, '0');
      const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`;
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
        traceparent,
      };
    }

    if (carrier?.traceparent && typeof carrier.traceparent === 'string') {
      const parts = carrier.traceparent.split('-');
      if (parts.length >= 4) {
        return {
          traceId: parts[1],
          spanId: parts[2],
          traceFlags: parseInt(parts[3], 16),
          traceparent: carrier.traceparent,
        };
      }
    }

    return {};
  }

  /**
   * Runs an asynchronous operation within a named span.
   */
  public async runWithSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes: Record<string, string | number | boolean> = {},
    parentContext?: Context,
  ): Promise<T> {
    const activeCtx = parentContext || context.active();
    const span = this.getTracer().startSpan(spanName, { attributes }, activeCtx);

    return context.with(trace.setSpan(activeCtx, span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error?.message || 'Span execution error',
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Custom helper to profile compilation and test execution runner subprocesses.
   * Emits child spans measuring compile vs test execution time.
   */
  public async measureExecutionSubprocess<T>(
    phase: 'compile' | 'test_eval' | 'sandbox_run',
    metadata: {
      language?: string;
      submissionId?: string;
      battleId?: string;
    },
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.runWithSpan(`code_runner.${phase}`, async (span) => {
      if (metadata.language) span.setAttribute('code.language', metadata.language);
      if (metadata.submissionId) span.setAttribute('code.submission_id', metadata.submissionId);
      if (metadata.battleId) span.setAttribute('code.battle_id', metadata.battleId);

      const start = Date.now();
      try {
        const res = await fn();
        span.setAttribute('code.duration_ms', Date.now() - start);
        return res;
      } catch (err: any) {
        span.setAttribute('code.duration_ms', Date.now() - start);
        span.setAttribute('code.error', true);
        throw err;
      }
    });
  }

  /**
   * Injects trace context into BullMQ job payload data.
   */
  public injectJobTraceData<D extends Record<string, any>>(jobData: D): D & { _traceContext: TraceContextCarrier } {
    const carrier: TraceContextCarrier = {};
    this.injectContext(context.active(), carrier);
    return {
      ...jobData,
      _traceContext: carrier,
    };
  }

  /**
   * Wraps BullMQ job handler to propagate trace context from job payload into active context.
   */
  public async runWithJobTrace<T>(
    job: { name: string; id?: string; data?: { _traceContext?: TraceContextCarrier } },
    handler: (span: Span) => Promise<T>,
  ): Promise<T> {
    const parentContext = job.data?._traceContext
      ? this.extractContext(job.data._traceContext)
      : ROOT_CONTEXT;

    return this.runWithSpan(
      `bullmq.job:${job.name}`,
      async (span) => {
        if (job.id) span.setAttribute('bullmq.job_id', job.id);
        span.setAttribute('bullmq.job_name', job.name);
        return handler(span);
      },
      {},
      parentContext,
    );
  }
}
