import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { performance } from 'node:perf_hooks';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Express's route template is bounded; never label with a raw URL or user ID.
    const path: unknown = (request.route as { path?: unknown } | undefined)
      ?.path;
    const route = typeof path === 'string' ? path : 'unmatched';
    const started = performance.now();
    let errorStatus: number | undefined;

    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = (error as { status?: unknown })?.status;
        errorStatus = typeof status === 'number' ? status : 500;
        return throwError(() => error);
      }),
      finalize(() => {
        this.metrics.recordHttp(
          request.method,
          route,
          errorStatus ?? response.statusCode,
          (performance.now() - started) / 1000,
        );
      }),
    );
  }
}
