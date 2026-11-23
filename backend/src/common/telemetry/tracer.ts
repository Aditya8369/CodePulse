import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  Tracer,
  Context,
  SpanKind,
  Attributes,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Ensure global W3C TraceContext propagator is registered
try {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
} catch {
  // Ignore if already set
}

export interface W3CTraceContext {
  version: string;
  traceId: string;
  parentSpanId: string;
  traceFlags: string;
  isSampled: boolean;
  rawTraceparent: string;
}

export interface SpanMetadata {
  traceId: string;
  spanId: string;
  traceparent: string;
}

export interface TelemetryExporterConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
  exportFormat: 'grpc' | 'http';
  sampleRate: number;
}

/**
 * Parses a standard W3C traceparent header string:
 * Format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
export function parseW3CTraceparent(traceparent?: string): W3CTraceContext | null {
  if (!traceparent || typeof traceparent !== 'string') return null;

  const parts = traceparent.trim().split('-');
  if (parts.length < 4) return null;

  const [version, traceId, parentSpanId, traceFlags] = parts;
  if (version !== '00') return null;
  if (traceId.length !== 32 || traceId === '00000000000000000000000000000000') return null;
  if (parentSpanId.length !== 16 || parentSpanId === '0000000000000000') return null;

  const flagsNum = parseInt(traceFlags, 16);
  const isSampled = (flagsNum & 1) === 1;

  return {
    version,
    traceId,
    parentSpanId,
    traceFlags,
    isSampled,
    rawTraceparent: traceparent,
  };
}

/**
 * Formats a valid W3C traceparent string
 */
export function formatW3CTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Generates random hexadecimal IDs conforming to W3C specifications
 */
export function generateRandomHex(length: number): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * OpenTelemetry Backend Distributed Tracer
 */
export class BackendTracer {
  private static instance: BackendTracer;
  private readonly tracer: Tracer;
  private readonly config: TelemetryExporterConfig;

  constructor(customConfig?: Partial<TelemetryExporterConfig>) {
    this.config = {
      serviceName: process.env.OTEL_SERVICE_NAME || 'codepulse-backend',
      serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      exportFormat: (process.env.OTEL_EXPORTER_TYPE as 'grpc' | 'http') || 'http',
      sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || '1.0'),
      ...customConfig,
    };

    this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
  }

  public static getInstance(): BackendTracer {
    if (!BackendTracer.instance) {
      BackendTracer.instance = new BackendTracer();
    }
    return BackendTracer.instance;
  }

  public getTracer(): Tracer {
    return this.tracer;
  }

  public getConfig(): TelemetryExporterConfig {
    return { ...this.config };
  }

  /**
   * Extracts or starts a span linked to an incoming W3C traceparent header
   */
  public startServerSpan(
    spanName: string,
    incomingTraceparent?: string,
    attributes?: Attributes,
  ): { span: Span; traceparent: string } {
    let parentCtx: Context = context.active();

    if (incomingTraceparent) {
      parentCtx = propagation.extract(context.active(), { traceparent: incomingTraceparent });
    }

    const span = this.tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes,
      },
      parentCtx,
    );

    const spanContext = span.spanContext();
    const traceparent = formatW3CTraceparent(
      spanContext.traceId,
      spanContext.spanId,
      (spanContext.traceFlags & 1) === 1,
    );

    return { span, traceparent };
  }

  /**
   * Traces an asynchronous database or Prisma SQL query
   */
  public async traceDatabaseQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>,
    parentSpan?: Span,
  ): Promise<T> {
    const parentCtx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();
    const span = this.tracer.startSpan(
      `db.${table}.${operation}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.name': 'codepulse_db',
          'db.operation': operation,
          'db.sql.table': table,
        },
      },
      parentCtx,
    );

    try {
      const result = await queryFn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Traces an asynchronous Redis cache or queue operation
   */
  public async traceRedisOperation<T>(
    command: string,
    key: string,
    redisFn: () => Promise<T>,
    parentSpan?: Span,
  ): Promise<T> {
    const parentCtx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();
    const span = this.tracer.startSpan(
      `redis.${command}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'redis',
          'redis.command': command,
          'redis.key': key,
        },
      },
      parentCtx,
    );

    try {
      const result = await redisFn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Wraps an execution in an active span with error recording
   */
  public async runInSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
    parentContext?: Context,
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      spanName,
      { attributes },
      parentContext || context.active(),
      async (span: Span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}

export const defaultBackendTracer = BackendTracer.getInstance();
