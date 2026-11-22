import { ExecutionContext, HttpStatus, HttpException } from '@nestjs/common';
import { AdaptiveThrottlerGuard } from './adaptive-throttler.guard';
import { IpReputationService } from './ip-reputation.service';

describe('AdaptiveThrottlerGuard & IpReputationService', () => {
  let reputationService: IpReputationService;
  let guard: AdaptiveThrottlerGuard;

  beforeEach(() => {
    reputationService = new IpReputationService();
    guard = new AdaptiveThrottlerGuard(reputationService);
  });

  const createMockContext = (ip: string, headers: Record<string, string> = {}) => {
    const responseHeaders: Record<string, any> = {};
    const req = {
      headers: { 'x-forwarded-for': ip, ...headers },
      socket: { remoteAddress: ip },
    };
    const res = {
      setHeader: (key: string, val: any) => {
        responseHeaders[key] = val;
      },
      headers: responseHeaders,
    };
    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext,
      responseHeaders,
    };
  };

  it('allocates generous 120 req/min for clean developer IPs (threat score < 20)', async () => {
    const { context, responseHeaders } = createMockContext('127.0.0.1');

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(responseHeaders['X-RateLimit-Limit']).toBe(120);
    expect(responseHeaders['X-Threat-Score']).toBeLessThan(20);
  });

  it('severely throttles Tor exit nodes (+50 threat) to 30 req/min', async () => {
    const { context, responseHeaders } = createMockContext('185.220.101.5'); // Tor IP

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(responseHeaders['X-Threat-Score']).toBeGreaterThanOrEqual(50);
    expect(responseHeaders['X-RateLimit-Limit']).toBe(30);
  });

  it('throttles botnet IPs (>60 threat) with 429 Too Many Requests and Retry-After header', async () => {
    const botIp = '185.220.101.5';
    // Record rapid 4xx failures to push threat score > 60
    await reputationService.recordFailure(botIp);

    const { context, responseHeaders } = createMockContext(botIp);

    // Consume all 3 tokens
    await guard.canActivate(context); // 1
    await guard.canActivate(context); // 2
    await guard.canActivate(context); // 3

    // 4th request must throw 429
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(responseHeaders['Retry-After']).toBeDefined();
    expect(responseHeaders['X-Threat-Score']).toBeGreaterThan(60);
  });
});
