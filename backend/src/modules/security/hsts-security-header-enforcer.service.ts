import { Injectable } from '@nestjs/common';

@Injectable()
export class HstsSecurityHeaderEnforcerService {
  public generateStrictSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    };
  }
}
