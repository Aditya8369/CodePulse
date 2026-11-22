import { ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_METADATA_KEY } from './idempotent.decorator';

describe('IdempotencyInterceptor & IdempotencyService', () => {
  let interceptor: IdempotencyInterceptor;
  let service: IdempotencyService;
  let reflector: Reflector;

  beforeEach(() => {
    service = new IdempotencyService();
    reflector = new Reflector();
    interceptor = new IdempotencyInterceptor(reflector, service);
  });

  afterEach(() => {
    service.clear();
  });

  function createMockContext({
    key = 'uuid-key-123',
    body = { code: 'console.log(1)' },
    options = { lifetimeSeconds: 60, enforceHeader: true },
  }: {
    key?: string | undefined;
    body?: unknown;
    options?: unknown;
  }) {
    const headers: Record<string, string> = {};
    if (key) {
      headers['idempotency-key'] = key;
    }

    const setHeaders: Record<string, string> = {};
    const req = {
      headers,
      method: 'POST',
      url: '/battles/submit',
      originalUrl: '/battles/submit',
      user: { id: 'user-alice' },
      body,
    };

    const res = {
      statusCode: 200,
      setHeader: (name: string, val: string) => {
        setHeaders[name] = val;
      },
      status: (code: number) => {
        res.statusCode = code;
      },
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options);

    return { context, req, res, setHeaders };
  }

  it('executes handler on first submission and caches result', async () => {
    const { context } = createMockContext({ key: 'test-1' });
    const handler = { handle: vi.fn().mockReturnValue(of({ success: true, elo: 1200 })) } as CallHandler;

    const obs = await interceptor.intercept(context, handler);
    const result = await lastValueFrom(obs);

    expect(result).toEqual({ success: true, elo: 1200 });
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('returns cached response and sets Idempotent-Replayed header on duplicate submission', async () => {
    const { context, setHeaders } = createMockContext({ key: 'test-replay' });
    const handler = { handle: vi.fn().mockReturnValue(of({ battleId: 'b-1' })) } as CallHandler;

    // First call
    const firstObs = await interceptor.intercept(context, handler);
    await lastValueFrom(firstObs);
    expect(handler.handle).toHaveBeenCalledTimes(1);

    // Second call with identical key and payload
    const secondObs = await interceptor.intercept(context, handler);
    const secondResult = await lastValueFrom(secondObs);

    expect(secondResult).toEqual({ battleId: 'b-1' });
    // Handler should NOT be called again
    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(setHeaders['Idempotent-Replayed']).toBe('true');
  });

  it('throws 409 Conflict when identical request is IN_FLIGHT', async () => {
    const key = 'in-flight-key';
    const fingerprint = service.computeFingerprint('POST', '/battles/submit', 'user-alice', { x: 1 });
    await service.acquireKey(key, fingerprint, 60);

    const { context } = createMockContext({ key, body: { x: 1 } });
    const handler = { handle: vi.fn() } as CallHandler;

    await expect(interceptor.intercept(context, handler)).rejects.toThrow(
      new HttpException(
        'A request with this idempotency key is currently in progress',
        HttpStatus.CONFLICT,
      ),
    );
  });

  it('throws 422 Unprocessable Entity when key is reused with modified payload', async () => {
    const key = 'modified-payload-key';
    const { context: context1 } = createMockContext({ key, body: { attempt: 1 } });
    const handler = { handle: vi.fn().mockReturnValue(of({ ok: true })) } as CallHandler;

    const obs1 = await interceptor.intercept(context1, handler);
    await lastValueFrom(obs1);

    // Same key, different body
    const { context: context2 } = createMockContext({ key, body: { attempt: 2 } });
    await expect(interceptor.intercept(context2, handler)).rejects.toThrow(
      new HttpException(
        'Idempotency key payload mismatch: a different payload was previously submitted with this key',
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
  });

  it('throws 400 Bad Request when Idempotency-Key header is missing and enforceHeader is true', async () => {
    const { context } = createMockContext({ key: undefined });
    const handler = { handle: vi.fn() } as CallHandler;

    await expect(interceptor.intercept(context, handler)).rejects.toThrow(
      new HttpException(
        'Idempotency-Key header is required for this operation',
        HttpStatus.BAD_REQUEST,
      ),
    );
  });
});
