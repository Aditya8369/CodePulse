import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../../modules/auth/api-key.service';
import { RedisService } from '../redis/redis.service';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const request = context.switchToHttp().getRequest();
    const rawKey = this.extractApiKey(request);

    if (!rawKey) {
      throw new UnauthorizedException(
        'API key is required in x-api-key header or Authorization: Api-Key <key>',
      );
    }

    // Validate key & scopes
    const apiKeyRecord = await this.apiKeyService.validateKey(rawKey, requiredScopes);

    // Rate limiting per API key (default 1000 req/hr token bucket)
    if (this.redisService) {
      const limit = apiKeyRecord.rateLimit || 1000;
      const refillRatePerSec = limit / 3600; // hourly refill rate

      const rateLimitResult = await this.redisService.checkTokenBucket(
        `apikey:${apiKeyRecord.id}`,
        {
          capacity: limit,
          refillRatePerSec,
          cost: 1,
        },
      );

      const response = context.switchToHttp().getResponse();
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
        response.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
        response.setHeader('X-RateLimit-Reset', rateLimitResult.resetSeconds.toString());
      }

      if (!rateLimitResult.allowed) {
        if (response && typeof response.setHeader === 'function') {
          response.setHeader('Retry-After', rateLimitResult.retryAfterSeconds.toString());
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'API key rate limit exceeded. Try again later.',
            retryAfterSeconds: rateLimitResult.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Attach API key and authenticated user to the request context
    request.apiKey = apiKeyRecord;
    if (apiKeyRecord.user) {
      request.user = apiKeyRecord.user;
    }

    return true;
  }

  private extractApiKey(request: any): string | null {
    if (!request || !request.headers) {
      return null;
    }

    // Check x-api-key header (case-insensitive)
    const xApiKey =
      request.headers['x-api-key'] || request.headers['X-API-KEY'] || request.headers['x-api_key'];
    if (xApiKey && typeof xApiKey === 'string' && xApiKey.trim().length > 0) {
      return xApiKey.trim();
    }

    // Check Authorization header: "Api-Key <key>", "ApiKey <key>", or "Bearer cp_live_<...>"
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const trimmed = authHeader.trim();
      if (trimmed.startsWith('Api-Key ')) {
        return trimmed.slice(8).trim();
      }
      if (trimmed.startsWith('ApiKey ')) {
        return trimmed.slice(7).trim();
      }
      if (trimmed.startsWith('Bearer cp_live_')) {
        return trimmed.slice(7).trim();
      }
    }

    return null;
  }
}

