import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { SingleflightService } from './singleflight.service';

export const XFETCH_CACHE_METADATA = 'XFETCH_CACHE_METADATA';

export interface CachedXFetchOptions {
  ttlSeconds?: number;
  beta?: number;
  keyPrefix?: string;
}

/**
 * Decorator to apply XFetch probabilistic early-expiration caching
 * and Singleflight request deduplication on controller endpoints.
 */
export const CachedXFetch = (options?: CachedXFetchOptions) =>
  SetMetadata(XFETCH_CACHE_METADATA, options || {});

@Injectable()
export class XFetchCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly singleflight: SingleflightService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<CachedXFetchOptions>(
      XFETCH_CACHE_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const prefix = options.keyPrefix || `${context.getClass().name}:${context.getHandler().name}`;
    const url = request?.url || '';
    const query = JSON.stringify(request?.query || {});
    const cacheKey = `xfetch:${prefix}:${url}:${query}`;

    const ttlSeconds = options.ttlSeconds ?? 60;
    const beta = options.beta ?? 1.0;

    return from(
      this.singleflight.fetchWithXFetch({
        key: cacheKey,
        ttlSeconds,
        beta,
        fetcher: async () => {
          const result = await next.handle().toPromise();
          return result;
        },
      }),
    );
  }
}
