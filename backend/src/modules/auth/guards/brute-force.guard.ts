import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BruteForceService } from '../brute-force.service';

@Injectable()
export class BruteForceGuard implements CanActivate {
  constructor(private readonly bruteForceService: BruteForceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract target identifier from body
    const body = request.body || {};
    const identifier = body.email || body.username || body.authEmail;

    // Extract client IP address (supporting reverse proxy x-forwarded-for)
    const ip = this.extractClientIp(request);

    // Check account lockout status across both user and IP dimensions
    const lockout = await this.bruteForceService.getLockout(identifier, ip);

    if (lockout.isLocked) {
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('Retry-After', lockout.retryAfterSeconds.toString());
        response.setHeader('X-Account-Locked', 'true');
        response.setHeader('X-Retry-After-Seconds', lockout.retryAfterSeconds.toString());
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: lockout.requiresEmailUnlock
            ? 'Account is locked due to 10+ failed login attempts. An email unlock link has been dispatched.'
            : `Account is temporarily locked due to excessive failed login attempts. Please try again in ${lockout.retryAfterSeconds} seconds.`,
          retryAfterSeconds: lockout.retryAfterSeconds,
          requiresEmailUnlock: lockout.requiresEmailUnlock,
          attemptCount: lockout.attemptCount,
          lockoutTier: lockout.lockoutTier,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private extractClientIp(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
      }
    }
    return req.ips?.length ? req.ips[0] : req.ip || req.connection?.remoteAddress || '127.0.0.1';
  }
}
