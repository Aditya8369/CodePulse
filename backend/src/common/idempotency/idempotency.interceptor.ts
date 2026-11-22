import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Response } from 'express';
import { IDEMPOTENT_METADATA_KEY, IdempotentOptions } from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  public async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.getAllAndOverride<IdempotentOptions>(
      IDEMPOTENT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint is not decorated with @Idempotent, proceed normally
    if (!options) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse<Response>();

    const rawKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'];

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key) {
      if (options.enforceHeader) {
        throw new HttpException(
          'Idempotency-Key header is required for this operation',
          HttpStatus.BAD_REQUEST,
        );
      }
      return next.handle();
    }

    const userId = req.user?.id || req.user?.username || req.ip || 'anonymous';
    const method = req.method || 'POST';
    const path = req.originalUrl || req.url || '';
    const body = req.body || {};

    const fingerprint = this.idempotencyService.computeFingerprint(
      method,
      path,
      userId,
      body,
    );

    const ttl = options.lifetimeSeconds ?? 120;
    const { state, record } = await this.idempotencyService.acquireKey(
      key,
      fingerprint,
      ttl,
    );

    if (state === 'PAYLOAD_MISMATCH') {
      throw new HttpException(
        'Idempotency key payload mismatch: a different payload was previously submitted with this key',
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (state === 'IN_FLIGHT') {
      throw new HttpException(
        'A request with this idempotency key is currently in progress',
        HttpStatus.CONFLICT, // 409
      );
    }

    if (state === 'COMPLETED' && record) {
      res.setHeader('Idempotent-Replayed', 'true');
      if (record.statusCode) {
        res.status(record.statusCode);
      }
      return of(record.body);
    }

    // ACQUIRED: execute handler and capture output
    return next.handle().pipe(
      tap(async (responseBody) => {
        const statusCode = res.statusCode || 200;
        await this.idempotencyService.saveResponse(
          key,
          fingerprint,
          statusCode,
          {},
          responseBody,
          ttl,
        );
      }),
      catchError(async (err) => {
        await this.idempotencyService.releaseKey(key);
        throw err;
      }),
    );
  }
}
