import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { MetricsService } from '../../modules/metrics/metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsInterceptor', () => {
  const metrics = { recordHttp: jest.fn() };
  const interceptor = new MetricsInterceptor(
    metrics as unknown as MetricsService,
  );
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/users/private-id',
        route: { path: '/users/:id' },
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => metrics.recordHttp.mockClear());

  it('records the route template and response status without a user ID label', async () => {
    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') } as CallHandler),
    );
    expect(metrics.recordHttp).toHaveBeenCalledWith(
      'GET',
      '/users/:id',
      200,
      expect.any(Number),
    );
    expect(JSON.stringify(metrics.recordHttp.mock.calls)).not.toContain(
      'private-id',
    );
  });

  it('records the HTTP error code and propagates the original exception', async () => {
    const error = { status: 404, message: 'Missing' };
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => error),
        } as CallHandler),
      ),
    ).rejects.toBe(error);
    expect(metrics.recordHttp).toHaveBeenCalledWith(
      'GET',
      '/users/:id',
      404,
      expect.any(Number),
    );
  });
});
