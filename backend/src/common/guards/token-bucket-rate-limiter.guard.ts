import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface RateLimitBucket {
  timestamps: number[];
}

@Injectable()
export class TokenBucketRateLimiterGuard implements CanActivate {
  // In-memory fallback / cache mirroring Redis Sorted Set sliding-window
  private static store: Map<string, RateLimitBucket> = new Map();

  private readonly maxRequests = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const endpoint = req.path || '/auth/login';
    const key = `ratelimit:${ip}:${endpoint}`;

    const now = Date.now();
    const windowStart = now - this.windowMs;

    let bucket = TokenBucketRateLimiterGuard.store.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      TokenBucketRateLimiterGuard.store.set(key, bucket);
    }

    // Filter out timestamps outside sliding window (equivalent to ZREMRANGEBYSCORE)
    bucket.timestamps = bucket.timestamps.filter(ts => ts > windowStart);

    const remaining = Math.max(0, this.maxRequests - bucket.timestamps.length);
    const resetTimestamp = Math.ceil((now + this.windowMs) / 1000);

    // Standard rate limit response headers
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1));
    res.setHeader('X-RateLimit-Reset', resetTimestamp);

    if (bucket.timestamps.length >= this.maxRequests) {
      const retryAfterSeconds = Math.ceil(this.windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    bucket.timestamps.push(now);
    return true;
  }
}
