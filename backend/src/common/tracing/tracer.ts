import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  Tracer,
  Context,
  SpanOptions,
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

// Ensure global W3C TraceContext propagator is registered for cross-service propagation
try {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
} catch {
  // Already registered or initialized
}

export interface W3CTraceCarrier {
  traceparent?: string;
  tracestate?: string;
  [key: string]: unknown;
}

export interface TraceContextDetails {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  traceparent?: string;
}

export type BusinessBottleneckType =
  | 'elo.calculation'
  | 'ast.parsing'
  | 'webhook.signing'
  | 'bullmq.job'
  | 'redis.call'
  | 'prisma.query'
  | string;

export class OpenTelemetryTracerManager {
  private static instance: OpenTelemetryTracerManager;
  private sdk: NodeSDK | null = null;
  private tracerProvider: TracerProvider | null = null;
  private tracer: Tracer;
  private isInitialized = false;

  constructor() {
    this.ensureTracerProvider();
    this.tracer = trace.getTracer('codepulse-tracer', '1.0.0');
  }

  public static getInstance(): OpenTelemetryTracerManager {
    if (!OpenTelemetryTracerManager.instance) {
      OpenTelemetryTracerManager.instance = new OpenTelemetryTracerManager();
    }
    return OpenTelemetryTracerManager.instance;
  }

  private ensureTracerProvider(): void {
    if (!this.tracerProvider) {
      this.tracerProvider = new TracerProvider({
        sampler: OpenTelemetryTracerManager.resolveSampler(),
      });
      try {
        trace.setGlobalTracerProvider(this.tracerProvider);
      } catch {
        // Global provider may already be registered
      }
    }
  }

  public static resolveSampler() {
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

    // Default 10% adaptive sampling in production
    return new TraceIdRatioBasedSampler(0.1);
  }

  /**
   * Initializes OpenTelemetry NodeSDK with auto-instrumentations
   * and OTLP gRPC / HTTP exporter for Jaeger / Tempo / Zipkin collectors.
   */
  public async init(): Promise<void> {
    if (this.isInitialized || process.env.OTEL_SDK_DISABLED === 'true') {
      return;
    }

    const grpcEndpoint = process.env.OTEL_EXPORTER_OTLP_GRPC_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const httpEndpoint = process.env.OTEL_EXPORTER_OTLP_HTTP_ENDPOINT || 'http://localhost:4318/v1/traces';

    let traceExporter: any;
    try {
      if (grpcEndpoint && !grpcEndpoint.includes('4318')) {
        traceExporter = new OTLPGrpcTraceExporter({
          url: grpcEndpoint,
        });
      } else {
        traceExporter = new OTLPHttpTraceExporter({
          url: httpEndpoint,
        });
      }
    } catch {
      traceExporter = new OTLPHttpTraceExporter({
        url: httpEndpoint,
      });
    }

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
      sampler: OpenTelemetryTracerManager.resolveSampler(),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // avoid noisy filesystem spans
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
          '@opentelemetry/instrumentation-redis': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
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

  public getTracer(name = 'codepulse-tracer', version = '1.0.0'): Tracer {
    return this.tracer || trace.getTracer(name, version);
  }

  /**
   * Extracts W3C TraceContext from carrier headers/metadata
   */
  public extractContext(carrier: W3CTraceCarrier): Context {
    return propagation.extract(context.active(), carrier);
  }

  /**
   * Injects current or provided context into carrier headers/metadata
   */
  public injectContext(
    activeContext: Context = context.active(),
    carrier: W3CTraceCarrier = {},
  ): W3CTraceCarrier {
    propagation.inject(activeContext, carrier);
    return carrier;
  }

  /**
   * Returns current active traceId or extracts from carrier
   */
  public getTraceInfo(carrier?: W3CTraceCarrier): TraceContextDetails {
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
   * Creates a custom child span for business logic bottlenecks
   * (e.g. Elo calculation, AST parsing, webhook signing, BullMQ background jobs).
   */
  public createChildSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {},
    parentContext?: Context,
  ): Span {
    const activeCtx = parentContext || context.active();
    return this.getTracer().startSpan(name, { attributes }, activeCtx);
  }

  /**
   * Executes an asynchronous business operation within an isolated child span.
   */
  public async runWithSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes: Record<string, string | number | boolean> = {},
    parentContext?: Context,
  ): Promise<T> {
    const activeCtx = parentContext || context.active();
    const span = this.createChildSpan(spanName, attributes, activeCtx);

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
   * Specialized helper to trace business logic bottlenecks:
   * 'elo.calculation', 'ast.parsing', 'webhook.signing', 'bullmq.job', etc.
   */
  public async traceBusinessOperation<T>(
    bottleneckType: BusinessBottleneckType,
    operationFn: (span: Span) => Promise<T>,
    metadata: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    return this.runWithSpan(
      `bottleneck.${bottleneckType}`,
      operationFn,
      {
        'business.bottleneck': bottleneckType,
        ...metadata,
      },
    );
  }
}

// Global exported helpers
export const tracerManager = OpenTelemetryTracerManager.getInstance();

export const initTracer = async (): Promise<void> => {
  await tracerManager.init();
};

export const shutdownTracer = async (): Promise<void> => {
  await tracerManager.shutdown();
};

export const getTracer = (name?: string, version?: string): Tracer => {
  return tracerManager.getTracer(name, version);
};

export const extractTraceContext = (carrier: W3CTraceCarrier): Context => {
  return tracerManager.extractContext(carrier);
};

export const injectTraceContext = (
  carrier: W3CTraceCarrier = {},
  ctx?: Context,
): W3CTraceCarrier => {
  return tracerManager.injectContext(ctx, carrier);
};

export const getTraceInfo = (carrier?: W3CTraceCarrier): TraceContextDetails => {
  return tracerManager.getTraceInfo(carrier);
};

export const createChildSpan = (
  name: string,
  attributes?: Record<string, string | number | boolean>,
  parentContext?: Context,
): Span => {
  return tracerManager.createChildSpan(name, attributes, parentContext);
};

export const runWithSpan = <T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
  parentContext?: Context,
): Promise<T> => {
  return tracerManager.runWithSpan(name, fn, attributes, parentContext);
};

export const traceBusinessOperation = <T>(
  bottleneckType: BusinessBottleneckType,
  operationFn: (span: Span) => Promise<T>,
  metadata?: Record<string, string | number | boolean>,
): Promise<T> => {
  return tracerManager.traceBusinessOperation(bottleneckType, operationFn, metadata);
};

