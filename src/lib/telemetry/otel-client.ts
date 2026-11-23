/**
 * OpenTelemetry Distributed Tracing Client for Next.js
 *
 * Implements W3C Trace Context specification (RFC traceparent: 00-traceid-spanid-flags)
 * to connect frontend user interactions, page navigation, and HTTP/WebSocket network
 * requests to backend NestJS, Redis, and PostgreSQL query waterfalls in Jaeger/Tempo.
 */

export interface W3CTraceContext {
  version: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
  traceparent: string;
}

export interface ClientSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'UNSET' | 'OK' | 'ERROR';
  errorMessage?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface OtelClientOptions {
  serviceName?: string;
  collectorUrl?: string;
  sampleRate?: number;
}

export class OtelBrowserClient {
  private static instance: OtelBrowserClient;
  private readonly serviceName: string;
  private readonly collectorUrl: string;
  private readonly sampleRate: number;
  private activeSpan: ClientSpan | null = null;
  private readonly finishedSpans: ClientSpan[] = [];

  constructor(options?: OtelClientOptions) {
    this.serviceName = options?.serviceName || 'codepulse-frontend';
    this.collectorUrl =
      options?.collectorUrl ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OTEL_EXPORTER_ENDPOINT) ||
      'http://localhost:4318/v1/traces';
    this.sampleRate = options?.sampleRate ?? 1.0;
  }

  public static getInstance(options?: OtelClientOptions): OtelBrowserClient {
    if (!OtelBrowserClient.instance) {
      OtelBrowserClient.instance = new OtelBrowserClient(options);
    }
    return OtelBrowserClient.instance;
  }

  /**
   * Generates a 32-character random hex trace ID conforming to W3C TraceContext
   */
  public generateTraceId(): string {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 32; i++) {
      id += chars[Math.floor(Math.random() * 16)];
    }
    return id;
  }

  /**
   * Generates a 16-character random hex span ID conforming to W3C TraceContext
   */
  public generateSpanId(): string {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += chars[Math.floor(Math.random() * 16)];
    }
    return id;
  }

  /**
   * Builds a valid W3C traceparent header string
   * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   */
  public createTraceparent(traceId?: string, spanId?: string, sampled = true): string {
    const tid = traceId || this.generateTraceId();
    const sid = spanId || this.generateSpanId();
    const flags = sampled ? '01' : '00';
    return `00-${tid}-${sid}-${flags}`;
  }

  /**
   * Parses an existing W3C traceparent header into structured tokens
   */
  public parseTraceparent(traceparent?: string): W3CTraceContext | null {
    if (!traceparent) return null;
    const parts = traceparent.trim().split('-');
    if (parts.length < 4) return null;

    const [version, traceId, spanId, traceFlags] = parts;
    if (version !== '00' || traceId.length !== 32 || spanId.length !== 16) {
      return null;
    }

    return {
      version,
      traceId,
      spanId,
      traceFlags,
      traceparent,
    };
  }

  /**
   * Starts a client interaction span and returns the span with its W3C traceparent
   */
  public startSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {},
    parentTraceparent?: string,
  ): { span: ClientSpan; traceparent: string } {
    let traceId = this.generateTraceId();
    let parentSpanId: string | undefined;

    if (parentTraceparent) {
      const parsed = this.parseTraceparent(parentTraceparent);
      if (parsed) {
        traceId = parsed.traceId;
        parentSpanId = parsed.spanId;
      }
    } else if (this.activeSpan) {
      traceId = this.activeSpan.traceId;
      parentSpanId = this.activeSpan.spanId;
    }

    const spanId = this.generateSpanId();
    const traceparent = this.createTraceparent(traceId, spanId, true);

    const span: ClientSpan = {
      name,
      traceId,
      spanId,
      parentSpanId,
      startTime: Date.now(),
      status: 'UNSET',
      attributes: {
        'service.name': this.serviceName,
        'telemetry.sdk.language': 'webjs',
        ...attributes,
      },
    };

    this.activeSpan = span;
    return { span, traceparent };
  }

  /**
   * Ends an active client span and calculates total latency
   */
  public endSpan(span: ClientSpan, status: 'OK' | 'ERROR' = 'OK', errorMessage?: string): ClientSpan {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (errorMessage) {
      span.errorMessage = errorMessage;
    }

    this.finishedSpans.push(span);
    if (this.activeSpan?.spanId === span.spanId) {
      this.activeSpan = null;
    }

    return span;
  }

  /**
   * Wraps an asynchronous action (e.g., button click, code submission) in a trace span
   */
  public async traceUserAction<T>(
    actionName: string,
    attributes: Record<string, string | number | boolean>,
    fn: (traceContext: { traceId: string; spanId: string; traceparent: string }) => Promise<T>,
  ): Promise<T> {
    const { span, traceparent } = this.startSpan(actionName, attributes);
    try {
      const result = await fn({
        traceId: span.traceId,
        spanId: span.spanId,
        traceparent,
      });
      this.endSpan(span, 'OK');
      return result;
    } catch (err) {
      this.endSpan(span, 'ERROR', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Traced fetch wrapper that injects W3C traceparent headers into HTTP requests
   */
  public async tracedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init.method || 'GET';

    const { span, traceparent } = this.startSpan(`HTTP ${method} ${url}`, {
      'http.method': method,
      'http.url': url,
    });

    const headers = new Headers(init.headers || {});
    headers.set('traceparent', traceparent);
    headers.set('x-trace-id', span.traceId);

    try {
      const response = await fetch(input, {
        ...init,
        headers,
      });

      span.attributes['http.status_code'] = response.status;
      this.endSpan(span, response.ok ? 'OK' : 'ERROR');
      return response;
    } catch (err) {
      this.endSpan(span, 'ERROR', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Retrieves current history of completed spans
   */
  public getFinishedSpans(): ClientSpan[] {
    return [...this.finishedSpans];
  }
}

export const otelClient = OtelBrowserClient.getInstance();
