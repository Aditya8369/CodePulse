import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from '../../modules/auth/api-key.service';
import { RedisService } from '../redis/redis.service';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';

describe('ApiKeyGuard (#310 Scoped Developer API Keys Guard)', () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;
  let apiKeyService: jest.Mocked<Partial<ApiKeyService>>;
  let redisService: RedisService;

  beforeEach(async () => {
    redisService = new RedisService();
    redisService.clearMemoryStores();

    apiKeyService = {
      validateKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        Reflector,
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    redisService.clearMemoryStores();
    jest.clearAllMocks();
  });

  function createMockContext(headers: Record<string, string>, handlerScopes?: string[]): {
    context: ExecutionContext;
    req: any;
    res: any;
    resHeaders: Record<string, string>;
  } {
    const resHeaders: Record<string, string> = {};
    const req: any = {
      headers,
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        resHeaders[k] = v;
      },
    };

    const mockHandler = () => {};
    const mockClass = class {};

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(handlerScopes || []);

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => mockHandler,
      getClass: () => mockClass,
    } as unknown as ExecutionContext;

    return { context, req, res, resHeaders };
  }

  describe('Header Extraction & Authentication', () => {
    it('throws UnauthorizedException when no API key header is present', async () => {
      const { context } = createMockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('extracts key from x-api-key header and validates successfully', async () => {
      const rawKey = 'cp_live_1234567890abcdef1234567890abcdef12345678';
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        scopes: ['read:analytics'],
        rateLimit: 1000,
        user: { id: 'user-1', username: 'alice' },
      });

      const { context, req, resHeaders } = createMockContext(
        { 'x-api-key': rawKey },
        ['read:analytics'],
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(apiKeyService.validateKey).toHaveBeenCalledWith(rawKey, ['read:analytics']);
      expect(req.apiKey.id).toBe('key-1');
      expect(req.user.username).toBe('alice');
      expect(resHeaders['X-RateLimit-Limit']).toBe('1000');
    });

    it('extracts key from Authorization: Api-Key header', async () => {
      const rawKey = 'cp_live_customapikey1234567890abcdef12345678';
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue({
        id: 'key-2',
        scopes: ['write:battles'],
        rateLimit: 500,
        user: { id: 'user-2' },
      });

      const { context, req } = createMockContext({
        authorization: `Api-Key ${rawKey}`,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(apiKeyService.validateKey).toHaveBeenCalledWith(rawKey, []);
      expect(req.apiKey.id).toBe('key-2');
    });

    it('extracts key from Authorization: Bearer cp_live_ header', async () => {
      const rawKey = 'cp_live_bearerkey1234567890abcdef1234567890';
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue({
        id: 'key-3',
        scopes: ['read:leaderboard'],
        rateLimit: 1000,
      });

      const { context, req } = createMockContext({
        authorization: `Bearer ${rawKey}`,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(apiKeyService.validateKey).toHaveBeenCalledWith(rawKey, []);
      expect(req.apiKey.id).toBe('key-3');
    });
  });

  describe('Rate Limiting per API Key via Redis Token Bucket', () => {
    it('enforces rate limits and throws TOO_MANY_REQUESTS when limit is exceeded', async () => {
      const rawKey = 'cp_live_ratelimitedkey1234567890abcdef1234';
      (apiKeyService.validateKey as jest.Mock).mockResolvedValue({
        id: 'rate-limited-key',
        scopes: ['read:analytics'],
        rateLimit: 2, // Only 2 requests burst capacity
      });

      const { context: ctx1 } = createMockContext({ 'x-api-key': rawKey });
      const { context: ctx2 } = createMockContext({ 'x-api-key': rawKey });
      const { context: ctx3, resHeaders } = createMockContext({ 'x-api-key': rawKey });

      expect(await guard.canActivate(ctx1)).toBe(true);
      expect(await guard.canActivate(ctx2)).toBe(true);

      // Third request within the same second exceeds capacity of 2
      await expect(guard.canActivate(ctx3)).rejects.toThrow(HttpException);
      expect(resHeaders['Retry-After']).toBeDefined();
    });
  });
});
