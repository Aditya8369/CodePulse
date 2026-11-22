import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { BruteForceGuard } from './brute-force.guard';
import { BruteForceService } from '../brute-force.service';

describe('BruteForceGuard (#312 Distributed Brute-Force Guard)', () => {
  let guard: BruteForceGuard;
  let bruteForceService: jest.Mocked<Partial<BruteForceService>>;

  beforeEach(async () => {
    bruteForceService = {
      getLockout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BruteForceGuard,
        { provide: BruteForceService, useValue: bruteForceService },
      ],
    }).compile();

    guard = module.get<BruteForceGuard>(BruteForceGuard);
  });

  function createMockContext(body: any, headers: Record<string, string> = {}): {
    context: ExecutionContext;
    req: any;
    res: any;
    resHeaders: Record<string, string>;
  } {
    const resHeaders: Record<string, string> = {};
    const req: any = {
      body,
      headers,
      ip: '198.51.100.1',
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        resHeaders[k] = v;
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, req, res, resHeaders };
  }

  it('allows request to proceed when account is not locked out', async () => {
    (bruteForceService.getLockout as jest.Mock).mockResolvedValue({
      isLocked: false,
      retryAfterSeconds: 0,
      attemptCount: 1,
      requiresEmailUnlock: false,
    });

    const { context } = createMockContext({ email: 'user@codepulse.io' });
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(bruteForceService.getLockout).toHaveBeenCalledWith(
      'user@codepulse.io',
      '198.51.100.1',
    );
  });

  it('rejects with HTTP 429 and Retry-After header when account is locked out', async () => {
    (bruteForceService.getLockout as jest.Mock).mockResolvedValue({
      isLocked: true,
      retryAfterSeconds: 285,
      attemptCount: 5,
      requiresEmailUnlock: false,
      lockoutTier: '5-minute Lockout',
    });

    const { context, resHeaders } = createMockContext(
      { email: 'victim@codepulse.io' },
      { 'x-forwarded-for': '203.0.113.55' },
    );

    try {
      await guard.canActivate(context);
      fail('Expected guard to throw HttpException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const res = err.getResponse();
      expect(res.retryAfterSeconds).toBe(285);
      expect(resHeaders['Retry-After']).toBe('285');
      expect(resHeaders['X-Account-Locked']).toBe('true');
    }
  });

  it('indicates email unlock required when 24-hour threshold is exceeded', async () => {
    (bruteForceService.getLockout as jest.Mock).mockResolvedValue({
      isLocked: true,
      retryAfterSeconds: 86400,
      attemptCount: 10,
      requiresEmailUnlock: true,
      lockoutTier: '24-hour Emergency Lockout',
    });

    const { context } = createMockContext({ username: 'heavily_attacked_user' });

    try {
      await guard.canActivate(context);
      fail('Expected guard to throw HttpException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      const res = err.getResponse();
      expect(res.requiresEmailUnlock).toBe(true);
      expect(res.retryAfterSeconds).toBe(86400);
    }
  });
});
