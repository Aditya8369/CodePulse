import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PiiRedactorService } from '../logging/pii-redactor.service';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class SanitizeLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly piiRedactor: PiiRedactorService,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Sanitize incoming headers and request body for safe logging
    const safeHeaders = this.piiRedactor.redactObject({ ...req.headers });
    const safeBody = req.body ? this.piiRedactor.redactObject({ ...req.body }) : undefined;

    this.logger.log(
      `Incoming HTTP ${method} ${url}`,
      'SanitizeLoggingInterceptor',
    );

    return next.handle().pipe(
      map((data) => {
        // Redact any accidental leakage in response body
        return this.piiRedactor.redactObject(data);
      }),
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = res.statusCode;
          this.logger.log(
            `Completed HTTP ${method} ${url} [${statusCode}] +${duration}ms`,
            'SanitizeLoggingInterceptor',
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          const safeError = this.piiRedactor.redactObject(err);
          this.logger.error(
            `Failed HTTP ${method} ${url} +${duration}ms - ${safeError.message}`,
            'SanitizeLoggingInterceptor',
          );
        },
      }),
    );
  }
}
