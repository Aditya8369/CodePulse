import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyListItemDto,
} from './dto/api-key.dto';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a cryptographically secure API key with prefix `cp_live_<random_bytes>`.
   * Stored as a SHA-256 hash. The raw key is returned ONLY ONCE upon creation.
   */
  async createApiKey(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    // Generate 24 random bytes (48 hex characters) -> total raw key length: 56 chars (> 40 chars)
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `cp_live_${randomHex}`;
    const keyPrefix = rawKey.substring(0, 16); // e.g. cp_live_a1b2c3d4
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const scopes =
      dto.scopes && dto.scopes.length > 0 ? dto.scopes : ['read:analytics'];
    const rateLimit = dto.rateLimit && dto.rateLimit > 0 ? dto.rateLimit : 1000;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const created = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        keyPrefix,
        scopes,
        rateLimit,
        expiresAt,
        userId,
      },
    });

    return {
      id: created.id,
      name: created.name,
      key: rawKey,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      rateLimit: created.rateLimit,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
    };
  }

  /**
   * Lists all active API keys for a developer user.
   * Returns metadata only (masked keyPrefix, scopes, lastUsedAt, expiresAt).
   * Plaintext keys and hashes are never exposed.
   */
  async listApiKeys(userId: string): Promise<ApiKeyListItemDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimit: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdAt: true,
      },
    });

    return keys;
  }

  /**
   * Revokes (deletes) an API key belonging to the user.
   */
  async revokeApiKey(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found or does not belong to user');
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'API key revoked successfully',
    };
  }

  /**
   * Validates a raw API key:
   * 1. Checks prefix cp_live_
   * 2. Hashes via SHA-256 and searches database
   * 3. Checks expiration
   * 4. Validates requested scopes against key permissions
   * 5. Asynchronously increments requestCount & updates lastUsedAt without blocking response
   */
  async validateKey(rawKey: string, requiredScopes: string[] = []): Promise<any> {
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('cp_live_')) {
      throw new UnauthorizedException('Invalid API key format. Key must start with cp_live_');
    }

    if (rawKey.length < 32) {
      throw new UnauthorizedException('Invalid API key length');
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            organizationRole: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid or unrecognized API key');
    }

    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      throw new UnauthorizedException('API key has expired');
    }

    // Check scope permissions
    if (requiredScopes && requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every((required) =>
        apiKey.scopes.includes('*') ||
        apiKey.scopes.includes('admin:*') ||
        apiKey.scopes.includes(required),
      );

      if (!hasAllScopes) {
        throw new ForbiddenException(
          `Insufficient permissions for this API key. Required scopes: [${requiredScopes.join(', ')}]`,
        );
      }
    }

    // Asynchronous non-blocking update of lastUsedAt and request counter
    this.updateKeyMetrics(apiKey.id);

    return apiKey;
  }

  /**
   * Non-blocking background update for request counter and lastUsedAt timestamp.
   */
  private updateKeyMetrics(keyId: string): void {
    this.prisma.apiKey
      .update({
        where: { id: keyId },
        data: {
          lastUsedAt: new Date(),
          requestCount: { increment: 1 },
        },
      })
      .catch((err: any) => {
        this.logger.warn(
          `Failed to asynchronously update API key metrics for ${keyId}: ${err?.message}`,
        );
      });
  }
}

