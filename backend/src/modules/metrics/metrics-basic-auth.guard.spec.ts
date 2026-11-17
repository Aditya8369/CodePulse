import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MetricsBasicAuthGuard } from './metrics-basic-auth.guard';

describe('MetricsBasicAuthGuard', () => {
  const response = { setHeader: jest.fn() };
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          METRICS_BASIC_AUTH_USER: 'scraper',
          METRICS_BASIC_AUTH_PASSWORD: 'secret-value',
        })[key],
    ),
  };
  const guard = new MetricsBasicAuthGuard(config as unknown as ConfigService);

  function context(authorization?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    response.setHeader.mockClear();
    config.get.mockClear();
  });

  it('accepts valid Basic credentials', () => {
    const token = Buffer.from('scraper:secret-value').toString('base64');
    expect(guard.canActivate(context(`Basic ${token}`))).toBe(true);
  });

  it('rejects missing or wrong credentials with a challenge', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('Basic d3Jvbmc6cGFzcw=='))).toThrow(
      UnauthorizedException,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="CodePulse Metrics"',
    );
  });

  it('fails closed if either server credential is unset', () => {
    config.get.mockReturnValue(undefined);
    expect(() =>
      guard.canActivate(context('Basic c2NyYXBlcjpzZWNyZXQtdmFsdWU=')),
    ).toThrow(UnauthorizedException);
  });
});
