import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import {
  DEFAULT_CSRF_SECRET,
  extractCsrfCookie,
  generateCsrfToken,
  verifyCsrfTokenSignature,
} from '../security/csrf.util';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly secret: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.secret =
      this.configService?.get<string>('CSRF_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      DEFAULT_CSRF_SECRET;
  }

  use(
    req: Request & { csrfToken?: () => string; rawCsrfToken?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const isSecure =
      req.secure ||
      req.headers?.['x-forwarded-proto'] === 'https' ||
      process.env.NODE_ENV === 'production';

    // 1. Check if a valid signed token already exists in cookie
    const existingToken = extractCsrfCookie(req);
    let tokenToUse: string;

    if (existingToken && verifyCsrfTokenSignature(existingToken, this.secret)) {
      tokenToUse = existingToken;
    } else {
      tokenToUse = generateCsrfToken(this.secret).token;
    }

    // 2. Attach token getter for SPA / controllers
    req.csrfToken = () => tokenToUse;
    req.rawCsrfToken = tokenToUse;

    // 3. Set cookie with SameSite=Strict hardening and __Host- prefix when secure
    const cookieOptions = {
      sameSite: 'strict' as const,
      httpOnly: false, // HttpOnly=false so SPA JavaScript can extract for Double-Submit Header
      secure: isSecure,
      path: '/',
    };

    if (typeof res.cookie === 'function') {
      if (isSecure) {
        res.cookie('__Host-csrf-token', tokenToUse, {
          ...cookieOptions,
          secure: true,
        });
      }
      res.cookie('csrf-token', tokenToUse, cookieOptions);
    }

    // 4. Expose token in response header
    if (typeof res.setHeader === 'function') {
      res.setHeader('x-csrf-token', tokenToUse);
    }

    next();
  }
}

