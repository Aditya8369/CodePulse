import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface SlidingWindowLog {
  timestamps: number[];
}

@Injectable()
export class SlidingRateLimitGuard implements CanActivate {
  private static userLogs = new Map<string, SlidingWindowLog>();
  private readonly windowMs = 60 * 1000; // 1 minute

  getQuotaForRole(role?: string, tier?: string): number {
    if (role === 'ADMIN' || role === 'VERIFIED_BOT') return 1000;
    if (tier === 'Diamond' || tier === 'Platinum') return 300;
    if (tier === 'Bronze' || tier === 'Silver') return 120;
    return 30; // Anonymous / Guest default
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userRole = (req as any).user?.role;
    const userTier = (req as any).user?.tier;

    const limit = this.getQuotaForRole(userRole, userTier);
    const key = `ratelimit:${(req as any).user?.id || ip}`;

    const now = Date.now();
    const windowStart = now - this.windowMs;

    let log = SlidingRateLimitGuard.userLogs.get(key);
    if (!log) {
      log = { timestamps: [] };
      SlidingRateLimitGuard.userLogs.set(key, log);
    }

    // Evict expired entries (ZREMRANGEBYSCORE equivalent)
    log.timestamps = log.timestamps.filter(t => t > windowStart);

    const remaining = Math.max(0, limit - log.timestamps.length);
    const resetTime = Math.ceil((now + this.windowMs) / 1000);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1));
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (log.timestamps.length >= limit) {
      res.setHeader('Retry-After', 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `API rate limit of ${limit} requests/minute exceeded for your tier.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    log.timestamps.push(now);
    return true;
  }
}
