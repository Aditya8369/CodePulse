import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Socket } from 'socket.io';
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import {
  OtelTracerService,
  TraceContextCarrier,
} from '../observability/otel-tracer.service';
import {
  OpenTelemetryTracerManager,
  tracerManager,
  BusinessBottleneckType,
} from '../tracing/tracer';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TraceInterceptor.name);
  private readonly otelService: OtelTracerService;

  constructor() {
    this.otelService = OtelTracerService.getInstance();
  }

  intercept(execContext: ExecutionContext, next: CallHandler): Observable<any> {
    const type = execContext.getType();

    if (type === 'http') {
      return this.interceptHttp(execContext, next);
    }

    if (type === 'ws') {
      return this.interceptWs(execContext, next);
    }

    return next.handle();
  }

  /**
   * HTTP Request interception:
   * Extracts W3C traceparent and tracestate from incoming headers,
   * starts an active span, sets traceparent on response header,
   * injects traceId into error logs, and ends span upon completion/error.
   */
  private interceptHttp(
    execContext: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const req = execContext.switchToHttp().getRequest<Request>();
    const res = execContext.switchToHttp().getResponse<Response>();

    const carrier: TraceContextCarrier = {
      traceparent: req.headers['traceparent'] as string,
      tracestate: req.headers['tracestate'] as string,
    };

    const parentCtx = this.otelService.extractContext(carrier);
    const spanName = `HTTP ${req.method} ${req.route?.path || req.path}`;
    const span: Span = this.otelService
      .getTracer()
      .startSpan(spanName, undefined, parentCtx);

    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;
    const traceFlags = spanContext.traceFlags.toString(16).padStart(2, '0');
    const outgoingTraceparent = `00-${traceId}-${spanId}-${traceFlags}`;

    // Inject traceparent and traceId in response headers for client correlation
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('traceparent', outgoingTraceparent);
      res.setHeader('x-trace-id', traceId);
    }

    // Attach to req for downstream logger / controller accessibility
    (req as any).traceId = traceId;
    (req as any).traceparent = outgoingTraceparent;

    span.setAttribute('http.method', req.method);
    span.setAttribute('http.url', req.originalUrl || req.url);
    span.setAttribute('http.target', req.path);
    if (req.ip) span.setAttribute('http.client_ip', req.ip);

    return new Observable((subscriber) => {
      context.with(trace.setSpan(parentCtx, span), () => {
        next
          .handle()
          .pipe(
            tap(() => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.setAttribute('http.status_code', res.statusCode || 200);
              span.end();
            }),
            catchError((err: any) => {
              const status = err?.status || err?.statusCode || 500;
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err?.message || 'Internal error',
              });
              span.setAttribute('http.status_code', status);
              span.recordException(err);

              // Injects traceId into error response body so users and maintainers can cross-reference logs
              if (err && typeof err === 'object') {
                err.traceId = traceId;
                if (err.response && typeof err.response === 'object') {
                  err.response.traceId = traceId;
                } else if (typeof err.response === 'string') {
                  err.response = { message: err.response, traceId, statusCode: status };
                }
              }

              // Injects traceId into error logs allowing one-click lookup from logs to trace view
              this.logger.error(
                `[TraceID: ${traceId}] HTTP ${req.method} ${req.path} failed with status ${status}: ${err?.message}`,
                err?.stack,
              );

              span.end();
              return throwError(() => err);
            }),
          )
          .subscribe(subscriber);
      });
    });
  }

  /**
   * WebSocket Handshake and message frame interception:
   * Extracts W3C traceparent from handshake headers or message auth payload.
   */
  private interceptWs(
    execContext: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const client = execContext.switchToWs().getClient<Socket>();
    const data = execContext.switchToWs().getData();

    const headers = client?.handshake?.headers || {};
    const auth = client?.handshake?.auth || {};

    const traceparent =
      (headers['traceparent'] as string) ||
      (auth['traceparent'] as string) ||
      (data && typeof data === 'object' ? data['traceparent'] : undefined);

    const carrier: TraceContextCarrier = {
      traceparent,
      tracestate: headers['tracestate'] as string,
    };

    const parentCtx = this.otelService.extractContext(carrier);
    const eventName = execContext.getHandler()?.name || 'ws_event';
    const span = this.otelService
      .getTracer()
      .startSpan(`WS ${eventName}`, undefined, parentCtx);

    const spanContext = span.spanContext();
    span.setAttribute('ws.socket_id', client?.id || 'unknown');
    span.setAttribute('ws.event', eventName);

    return new Observable((subscriber) => {
      context.with(trace.setSpan(parentCtx, span), () => {
        next
          .handle()
          .pipe(
            tap(() => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
            }),
            catchError((err: any) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err?.message || 'WebSocket frame error',
              });
              span.recordException(err);
              this.logger.error(
                `[TraceID: ${spanContext.traceId}] WebSocket event ${eventName} error: ${err?.message}`,
                err?.stack,
              );
              span.end();
              return throwError(() => err);
            }),
          )
          .subscribe(subscriber);
      });
    });
  }

  /**
   * Creates custom child spans for business logic bottlenecks:
   * Elo calculation, AST parsing, webhook signing, etc.
   */
  public static traceBusinessBottleneck<T>(
    bottleneckType: BusinessBottleneckType,
    operationFn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return tracerManager.traceBusinessOperation(bottleneckType, operationFn, attributes);
  }
}
