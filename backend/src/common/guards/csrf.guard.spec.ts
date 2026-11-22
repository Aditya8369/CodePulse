import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import {
  DEFAULT_CSRF_SECRET,
  generateCsrfToken,
  compareCsrfTokens,
  verifyCsrfTokenSignature,
} from '../security/csrf.util';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

describe('CsrfGuard - Double-Submit Cookie CSRF Defense (#393)', () => {
  let guard: CsrfGuard;
  let reflector: Reflector;

  const validToken = generateCsrfToken(DEFAULT_CSRF_SECRET).token;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new CsrfGuard(reflector);
  });

  function createMockContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  describe('Safe HTTP Methods', () => {
    it('should allow GET requests without CSRF tokens', () => {
      const context = createMockContext({
        method: 'GET',
        headers: {},
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow HEAD requests without CSRF tokens', () => {
      const context = createMockContext({
        method: 'HEAD',
        headers: {},
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow OPTIONS preflight requests without CSRF tokens', () => {
      const context = createMockContext({
        method: 'OPTIONS',
        headers: {},
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('@SkipCsrf() Decorator', () => {
    it('should allow state-changing POST requests when @SkipCsrf() is applied', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = createMockContext({
        method: 'POST',
        headers: {},
      });

      expect(guard.canActivate(context)).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(SKIP_CSRF_KEY, [
        expect.anything(),
        expect.anything(),
      ]);
    });
  });

  describe('Cross-Origin Validation', () => {
    it('should reject requests with untrusted cross-origin origin header', () => {
      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'api.codepulse.dev',
          origin: 'https://evil-hacker.com',
          'x-csrf-token': validToken,
          cookie: `__Host-csrf-token=${validToken}`,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Cross-origin request rejected');
    });

    it('should accept requests matching the host origin', () => {
      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'api.codepulse.dev',
          origin: 'https://api.codepulse.dev',
          'x-csrf-token': validToken,
          cookie: `__Host-csrf-token=${validToken}`,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Double-Submit Token Validation', () => {
    it('should reject request when x-csrf-token header is missing', () => {
      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          cookie: `__Host-csrf-token=${validToken}`,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('CSRF token missing in request header');
    });

    it('should reject request when CSRF cookie is missing', () => {
      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          'x-csrf-token': validToken,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('CSRF cookie missing');
    });

    it('should reject request when header token and cookie token do not match', () => {
      const otherToken = generateCsrfToken(DEFAULT_CSRF_SECRET).token;

      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          'x-csrf-token': validToken,
          cookie: `__Host-csrf-token=${otherToken}`,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('CSRF token mismatch between header and cookie');
    });

    it('should reject request with forged/tampered cryptographic signature', () => {
      const forgedToken = `${validToken.split('.')[0]}.0000000000000000000000000000000000000000000000000000000000000000`;

      const context = createMockContext({
        method: 'PUT',
        headers: {
          host: 'localhost:3000',
          'x-csrf-token': forgedToken,
          cookie: `__Host-csrf-token=${forgedToken}`,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Invalid CSRF token signature');
    });

    it('should accept valid state-changing requests (POST, PUT, PATCH, DELETE) with matching signed tokens', () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const context = createMockContext({
          method,
          headers: {
            host: 'localhost:3000',
            'x-csrf-token': validToken,
            cookie: `csrf-token=${validToken}`,
          },
        });

        expect(guard.canActivate(context)).toBe(true);
      }
    });

    it('should support XSRF-TOKEN and x-xsrf-token header conventions', () => {
      const context = createMockContext({
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          'x-xsrf-token': validToken,
          cookie: `XSRF-TOKEN=${validToken}`,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Timing-Safe Constant-Time Comparison', () => {
    it('should return false for different token lengths without timing leakage', () => {
      expect(compareCsrfTokens('short', 'much_longer_token_value')).toBe(false);
    });

    it('should return false for empty or null tokens', () => {
      expect(compareCsrfTokens('', validToken)).toBe(false);
      expect(compareCsrfTokens(null, validToken)).toBe(false);
    });

    it('should return true for identical valid tokens', () => {
      expect(compareCsrfTokens(validToken, validToken)).toBe(true);
    });
  });
});

