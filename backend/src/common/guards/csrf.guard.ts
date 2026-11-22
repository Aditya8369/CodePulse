import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import {
  DEFAULT_CSRF_SECRET,
  SAFE_HTTP_METHODS,
  compareCsrfTokens,
  extractCsrfCookie,
  extractCsrfHeader,
  validateRequestOrigin,
  verifyCsrfTokenSignature,
} from '../security/csrf.util';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly secret: string;
  private readonly allowedOrigins: string[];

  constructor(
    @Optional() private readonly reflector?: Reflector,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.secret =
      this.configService?.get<string>('CSRF_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      DEFAULT_CSRF_SECRET;

    const rawAllowed =
      this.configService?.get<string>('ALLOWED_ORIGINS') ||
      process.env.ALLOWED_ORIGINS ||
      '';
    this.allowedOrigins = rawAllowed
      ? rawAllowed.split(',').map((o) => o.trim())
      : [];
  }

  canActivate(context: ExecutionContext): boolean {
    // 1. Check if route is explicitly marked with @SkipCsrf()
    if (this.reflector) {
      const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (skipCsrf) {
        return true;
      }
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method ? req.method.toUpperCase() : 'GET';

    // 2. Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF checks
    if (SAFE_HTTP_METHODS.has(method)) {
      return true;
    }

    // 3. Verify that cross-origin form submissions or requests are rejected
    const isOriginValid = validateRequestOrigin(req, this.allowedOrigins);
    if (!isOriginValid) {
      throw new ForbiddenException(
        'Cross-origin request rejected by CSRF defense',
      );
    }

    // 4. Extract token from request header (x-csrf-token)
    const headerToken = extractCsrfHeader(req);
    if (!headerToken) {
      throw new ForbiddenException(
        'CSRF token missing in request header (x-csrf-token required)',
      );
    }

    // 5. Extract token from cookie (__Host-csrf-token, csrf-token)
    const cookieToken = extractCsrfCookie(req);
    if (!cookieToken) {
      throw new ForbiddenException(
        'CSRF cookie missing (__Host-csrf-token required)',
      );
    }

    // 6. Cryptographic signature verification using HMAC-SHA256
    const isCookieSigValid = verifyCsrfTokenSignature(cookieToken, this.secret);
    if (!isCookieSigValid) {
      throw new ForbiddenException('Invalid CSRF token signature in cookie');
    }

    const isHeaderSigValid = verifyCsrfTokenSignature(headerToken, this.secret);
    if (!isHeaderSigValid) {
      throw new ForbiddenException('Invalid CSRF token signature in header');
    }

    // 7. Constant-time comparison (crypto.timingSafeEqual)
    const tokensMatch = compareCsrfTokens(headerToken, cookieToken);
    if (!tokensMatch) {
      throw new ForbiddenException(
        'CSRF token mismatch between header and cookie',
      );
    }

    return true;
  }
}

